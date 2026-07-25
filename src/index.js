require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const taskRoutes = require("./routes/tasks");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.json({ status: "CoinLoop API running" }));

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/tasks", taskRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`CoinLoop backend running on port ${PORT}`);
});
