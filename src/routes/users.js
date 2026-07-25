const express = require("express");
const prisma = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const referralsCount = await prisma.user.count({ where: { referredById: user.id } });

  res.json({
    id: user.id,
    username: user.username,
    coins: user.coins,
    referralCode: user.referralCode,
    referralsCount,
    createdAt: user.createdAt,
  });
});

module.exports = router;
