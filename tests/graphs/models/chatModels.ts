import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
dotenv.config();


export const buildModel = (modelName: string = "gpt-5") => {
  return new ChatOpenAI({
    model: modelName,
    apiKey: process.env.OPENAI_API_KEY,
  });
};

