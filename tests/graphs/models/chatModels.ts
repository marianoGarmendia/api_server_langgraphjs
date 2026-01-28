import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
dotenv.config();


export const buildModel = (modelName: string = "gpt-5-mini") => {
  return new ChatOpenAI({
    model: "gpt-4o",
    apiKey: process.env.OPENAI_API_KEY,
  });
};

