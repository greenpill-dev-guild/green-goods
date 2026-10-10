import { describe, expect, it } from "vitest";
import { isGreeting, parseCommand } from "../../services/reporting/coordinator/commands";

/** Account requests in plain words are commands; a story that shares a word with one is not. */
describe("account requests in plain words", () => {
  it.each([
    ["I would like to log in", "connect"],
    ["can I sign in please", "connect"],
    ["login", "connect"],
    ["link my wallet", "connect"],
    ["quiero iniciar sesión", "connect"],
    ["quero conectar minha conta", "connect"],
    ["log out", "disconnect"],
    ["please sign me out", "disconnect"],
    ["disconnect my account", "disconnect"],
    ["cerrar sesión", "disconnect"],
    ["switch account", "switch"],
    ["I want to connect a different account", "switch"],
    ["conectar otra cuenta", "switch"],
    ["use another account", "switch"],
    ["quero usar outra conta", "switch"],
  ])("reads %s as %s", (text, kind) => {
    expect(parseCommand(text)?.kind).toBe(kind);
  });

  it.each([
    "I connected the drip pipes to the new water tank today",
    "we logged in twelve seedlings",
    "change the title to fence planting",
    "sign in sheet printed for the volunteers",
    "link the photos to the report",
    "I want to change this",
    "can I use this",
    "change",
  ])("leaves %s for the report", (text) => {
    expect(parseCommand(text)).toBeNull();
  });

  it("knows a hello from a story", () => {
    expect(["hello", "Hi!", "good morning", "hola", "Olá, bom dia"].every(isGreeting)).toBe(true);
    expect(["hello I planted trees", "morning watering done", ""].some(isGreeting)).toBe(false);
  });
});
