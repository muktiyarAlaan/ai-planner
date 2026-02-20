import Anthropic, {
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  InternalServerError,
  APIConnectionError,
  APIError,
} from "@anthropic-ai/sdk";
import { decrypt } from "./crypto";

/**
 * Creates an Anthropic client using the user's decrypted API key.
 */
export function getAnthropicClient(encryptedApiKey: string): Anthropic {
  const apiKey = decrypt(encryptedApiKey);
  return new Anthropic({ apiKey });
}

/**
 * Validates an Anthropic API key by making a minimal test call.
 * Throws with a descriptive message if the key is invalid.
 */
export async function validateAnthropicKey(apiKey: string): Promise<void> {
  const client = new Anthropic({ apiKey });

  try {
    await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 10,
      messages: [{ role: "user", content: "Hi" }],
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw new Error(
        "Invalid API key. Please check your Anthropic API key and try again."
      );
    }
    if (error instanceof PermissionDeniedError) {
      throw new Error(
        "This API key does not have permission to access Claude. Please check your Anthropic account."
      );
    }
    if (error instanceof RateLimitError) {
      // Key is valid but rate limited — that's fine
      return;
    }
    if (error instanceof InternalServerError) {
      // API overloaded or server error — treat key as valid
      return;
    }
    if (error instanceof APIConnectionError) {
      throw new Error(
        "Unable to connect to Anthropic. Please check your internet connection."
      );
    }
    if (error instanceof APIError) {
      throw new Error(`Anthropic API error (${error.status}): ${error.message}`);
    }
    throw new Error("Failed to validate API key. Please try again.");
  }
}
