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
    return res.status(500).send(err.message);
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const user = req.headers.user;

  const messageTypes = {
    $or: [
      { type: "status" },
      { type: "message" },
      { type: "private_message", to: user },
      { type: "private_message", from: user },
    ],
  };

  try {
    if (!user) return res.sendStatus(422);

    const showMessages = await db
      .collection("messages")
      .find(messageTypes)
      .toArray();

    if (limit <= 0 || isNaN(limit)) {
      res.sendStatus(422);
    } else if (limit > 0) {
      res.send(showMessages.slice(-limit));
    } else {
      res.send(showMessages);
    }
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.header;

  const participantUser = await db
    .collection("participants")
    .findOne({ name: user });

  if (!participantUser) {
    res.sendStatus(404);
  } else {
    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
  }

  res.sendStatus(200);
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running in port: ${PORT}`));
