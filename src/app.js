import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;
try {
  await mongoClient.connect();
} catch (err) {
  console.log(err.message);
}
db = mongoClient.db();
const userSchema = joi.object({ name: joi.string().required() });
const messageSchema = joi.object({
  to: joi.string().min(1).required(),
  text: joi.string().min(1).required(),
  type: joi.string().valid("message", "private_message").required(),
});
app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const timeNow = dayjs().format("HH:mm:ss");
  const validation = userSchema.validate({ name }, { abortEarly: false });
  if (validation.error) {
    res.status(422).send(validation.error.details);
  }
  try {
    const resp = await db.collection("participants").findOne({ name: name });
    if (resp)
      return res
        .status(409)
        .send("Esse nome já está em uso!\nPor favor, tente um diferente.");
    await db.collection("participants").insertOne({
      name: name,
      lastStatus: Date.now(),
    });
    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: timeNow,
    });
    return res.sendStatus(201);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});
app.get("/participants", async (req, res) => {
  try {
    const resp = await db.collection("participants").find().toArray();
    return res.status(201).send(resp);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});
app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;
  const timeNow = dayjs().format("HH:mm:ss");
  const validation = messageSchema.validate(
    { to: to, text: text, type: type },
    { abortEarly: false }
  );
  if (validation.error) {
    const errors = validation.error.details.map((detail) => {
      detail.message;
    });
    res.status(422).send("erro aqui oh");
  }
  const participantOn = await db
    .collection("participants")
    .findOne({ name: from });
  if (!participantOn) {
    res.status(422).send("o erro eh aqui");
  }
  try {
    await db.collection("messages").insertOne({
      from: from,
      to: to,
      text: text,
      type: type,
      time: timeNow,
    });
    return res.sendStatus(201);
  } catch (err) {
    return res.status(422).send(err.message);
  }
});
app.get("/messages", async (req, res) => {
  const limit = req.query.limit;
  const { user } = req.headers;
  try {
    if (!user) return res.sendStatus(422);
    const showMessages = await db
      .collection("messages")
      .find({
        $or: [
          { type: "status" },
          { type: "message" },
          { to: user, type: "private_message" },
          { from: user, type: "private_message" },
        ],
      })
      .toArray();
    if (!limit) {
      res.status(200).send(showMessages);
    }
    if (limit > 0 && parseInt(limit) !== "NaN") {
      res.send(showMessages.slice(-limit));
    } else {
      res.sendStatus(422);
    }
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

app.post("/status", async (req, res) => {
  const user = req.header.user;

  if (!user) {
    res.status(422);
  }

  try {
    const participantUser = await db
      .collection("participants")
      .findOne({ name: user });

    if (!participantUser) {
      res.sendStatus(404);
    } else {
      res.sendStatus(201);
    }

    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(422);
  }
});

setInterval(async () => {
  const pastTime = Date.now() - 10000;
  const timeNow = dayjs().format("HH:mm:ss");

  try {
    const inactiveUsers = await db
      .collection("participants")
      .find({ lastStatus: { $gte: pastTime } })
      .toArray();

    if (inactiveUsers.length > 0) {
      await db.collection("messages").insertMany(
        inactiveUsers.map((user) => {
          return {
            from: user.name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: timeNow,
          };
        })
      );

      await db
        .collection("participants")
        .deleteMany({ lastStatus: { $gte: pastTime } });
    }
  } catch (err) {
    res.sendStatus(500);
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running in port: ${PORT}`));
