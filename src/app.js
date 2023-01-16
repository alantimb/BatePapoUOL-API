import express from "express";
import cors from "cors";
import { MongoClient, MongoClient, ObjectId } from "mongodb";
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

app.post("/participantes", async (req, res) => {
  const { name } = req.body;
  const timeNow = dayjs().format("HH:mm:ss");
  const userSchema = joi.object({ name: joi.string().required() });
  const validation = userSchema.validate(name);

  if (validation.error) {
    res.sendStatus(422);
  }

  try {
    const resp = await db.collection("participants").findOne({ name: name });

    if (resp) return res.status(409).send("Esse nome já existe!");

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

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running in port: ${PORT}`));
