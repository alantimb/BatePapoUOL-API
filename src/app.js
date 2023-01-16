import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const app = express();
dotenv.config();
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
const participantsCollection = db.collection("participants");
const messagesCollection = db.collection("messages");

app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const timeNow = dayjs().format("HH:mm:ss");
  const userSchema = joi.object({ name: joi.string().required() });
  const validation = userSchema.validate(name);

  if (validation.error) {
    res.status(422).send(validation.error.details);
  }

  try {
    const resp = await db.collection("participants").findOne({ name: name });

    if (resp)
      return res
        .status(409)
        .send("Esse nome já está em uso!\nPor favor, tente um diferente.");

    await participantsCollection.insertOne({
      name: name,
      lastStatus: Date.now(),
    });

    await messagesCollection.insertOne({
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
    const resp = await participantsCollection.find().toArray();

    return res.status(201).send(resp);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;
  const timeNow = dayjs().format("HH:mm:ss");

  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
    from: joi.string().required(),
  });
  const validation = messageSchema.validate(
    { to: to, text: text, type: type },
    { abortEarly: false }
  );

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
  }

  const participantOn = await participantsCollection.findOne({ name: from });

  if (!participantOn) {
    res.sendStatus(422);
  }

  try {
    await messagesCollection.insertOne({
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

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running in port: ${PORT}`));
