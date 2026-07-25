const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../db");

const router = express.Router();

function makeReferralCode(username) {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${username.slice(0, 3).toUpperCase()}${rand}`;
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    coins: user.coins,
    referralCode: user.referralCode,
    createdAt: user.createdAt,
  };
}

router.post("/signup", async (req, res) => {
  try {
    const { username, password, refCode } = req.body;

    if (!username || !password || password.length < 4) {
      return res.status(400).json({ error: "Username and password (4+ chars) required" });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
    }

    let referredBy = null;
    let bonus = 0;
    if (refCode) {
      referredBy = await prisma.user.findUnique({ where: { referralCode: refCode.toUpperCase() } });
      if (!referredBy) {
        return res.status(400).json({ error: "Invalid referral code" });
      }
      bonus = 20;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let referralCode = makeReferralCode(username);
    while (await prisma.user.findUnique({ where: { referralCode } })) {
      referralCode = makeReferralCode(username);
    }

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        coins: 50 + bonus,
        referralCode,
        referredById: referredBy ? referredBy.id : null,
      },
    });

    if (referredBy) {
      await prisma.user.update({
        where: { id: referredBy.id },
        data: { coins: { increment: 30 } },
      });
    }

    const token = signToken(user.id);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "Invalid username or password" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password" });

    const token = signToken(user.id);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;
