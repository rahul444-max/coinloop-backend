const express = require("express");
const prisma = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { username: true } },
      completions: { select: { userId: true } },
    },
    take: 100,
  });

  res.json(
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      reward: t.reward,
      slotsTotal: t.slotsTotal,
      slotsRemaining: t.slotsRemaining,
      creator: t.creator.username,
      completedBy: t.completions.map((c) => c.userId),
      createdAt: t.createdAt,
    }))
  );
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, reward, slots } = req.body;
    const rewardNum = parseInt(reward, 10);
    const slotsNum = parseInt(slots, 10) || 1;

    if (!title || !title.trim() || !rewardNum || rewardNum <= 0 || slotsNum <= 0) {
      return res.status(400).json({ error: "Valid title, reward and slots required" });
    }

    const totalCost = rewardNum * slotsNum;

    const task = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.userId } });
      if (user.coins < totalCost) {
        throw new Error("INSUFFICIENT_COINS");
      }

      await tx.user.update({
        where: { id: req.userId },
        data: { coins: { decrement: totalCost } },
      });

      return tx.task.create({
        data: {
          title: title.trim(),
          reward: rewardNum,
          slotsTotal: slotsNum,
          slotsRemaining: slotsNum,
          creatorId: req.userId,
        },
      });
    });

    res.json(task);
  } catch (err) {
    if (err.message === "INSUFFICIENT_COINS") {
      return res.status(400).json({ error: "Not enough coins" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create task" });
  }
});

router.post("/:id/complete", requireAuth, async (req, res) => {
  try {
    const taskId = req.params.id;

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id: taskId } });
      if (!task) throw new Error("NOT_FOUND");
      if (task.creatorId === req.userId) throw new Error("OWN_TASK");
      if (task.slotsRemaining <= 0) throw new Error("FULL");

      const already = await tx.taskCompletion.findUnique({
        where: { taskId_userId: { taskId, userId: req.userId } },
      });
      if (already) throw new Error("ALREADY_DONE");

      await tx.taskCompletion.create({ data: { taskId, userId: req.userId } });

      await tx.task.update({
        where: { id: taskId },
        data: { slotsRemaining: { decrement: 1 } },
      });

      const user = await tx.user.update({
        where: { id: req.userId },
        data: { coins: { increment: task.reward } },
      });

      return { coins: user.coins, reward: task.reward };
    });

    res.json(result);
  } catch (err) {
    const map = {
      NOT_FOUND: [404, "Task not found"],
      OWN_TASK: [400, "You can't complete your own task"],
      FULL: [400, "No slots remaining"],
      ALREADY_DONE: [400, "You already completed this task"],
    };
    const [status, message] = map[err.message] || [500, "Could not complete task"];
    res.status(status).json({ error: message });
  }
});

module.exports = router;
