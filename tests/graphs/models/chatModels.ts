import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
dotenv.config();


export const buildModel = (modelName: string = "gpt-5-mini") => {
  const apiKey =
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY_WIN_2_WIN?.trim() ||
    process.env.OPENAI_APIKEY?.trim() ||
    process.env.OPENAI_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      [
        "Missing OpenAI API key.",
        "Set one of these environment variables:",
        "- OPENAI_API_KEY (recommended)",
        "- OPENAI_API_KEY_WIN_2_WIN",
        "- OPENAI_APIKEY",
        "- OPENAI_KEY",
      ].join("\n"),
    );
  }

  return new ChatOpenAI({
    model: "gpt-4o",
    apiKey,
  });
};

