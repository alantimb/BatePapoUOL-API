import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
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

const userSchema = joi.object({ name: joi.string().required().min(1) });

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
    const resp = await db.collection("participants").findOne({ name });

    if (resp)
      return res
        .status(409)
        .send("Esse nome já está em uso!\nPor favor, tente um diferente.");

    await db.collection("participants").insertOne({
      name,
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
  const { user } = req.headers;
  const timeNow = dayjs().format("HH:mm:ss");
  console.log(user + "13");

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
    .findOne({ name: user });
  if (!participantOn) {
    res.status(422).send("o erro eh aqui");
  }
  try {
    await db.collection("messages").insertOne({
      from: user,
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
    const showMessages = await db
      .collection("messages")
      .find({
        $or: [
          { type: "status" },
          { type: "message" },
          { from: user },
          { to: user },
          { to: "Todos" },
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
  const { user } = req.headers;

  console.log(user);

  try {
    const participantUser = await db
      .collection("participants")
      .findOne({ name: user });

    if (!participantUser) {
      return res.sendStatus(404);
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
  try {
    const pastTime = Date.now() - 10000;

    const inactiveUsers = await db
      .collection("participants")
      .find({ lastStatus: { pastTime } })
      .toArray();

    inactiveUsers.map(async (user) => {
      await db.collection("participants").deleteOne({ _id: ObjectId(user.id) });
      const messageExit = {
        from: user.name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
      };
      await db.collection("messages").insertOne(messageExit);
    });
  } catch (err) {
    res.sendStatus(500);
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running in port: ${PORT}`));
