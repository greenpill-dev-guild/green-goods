import { generateNonce, SiweMessage } from "siwe";
import { Request, Response, Router } from "express";

export const identityRouter = Router();

// Returns the current user by checking the session returning 200 if the user is logged in and 401 if not
identityRouter.get("/nonce", async function (req: Request, res: Response) {
  req.session.nonce = generateNonce();
  res.status(200).send({ nonce: req.session.nonce });
});

// Returns the current user by checking the session returning 200 if the user is logged in and 401 if not
identityRouter.post("/login", async function (req: Request, res: Response) {
  const body = req.body as { message: string; signature: string };

  try {
    if (!body.message || !body.signature) {
      return res.status(400).send({ error: "Missing message, signature, or nonce" });
    }

    const SIWEObject = new SiweMessage(body.message);
    const { data: message } = await SIWEObject.verify({
      signature: body.signature,
      // @ts-ignore
      nonce: req.session.nonce,
    });

    req.session.siwe = message;
    if (message.expirationTime) {
      req.session.cookie.expires = new Date(message.expirationTime);
    }

    req.session.save(() => res.status(200).send(true));
  } catch (error) {
    req.session.siwe = null;
    req.session.nonce = null;

    const _error = error as Error;
    console.error(_error);

    return res.status(400).send({ error: _error.message });
  }
});

identityRouter.post("/logout", async function (req: Request, res: Response) {
  req.session.siwe = null;
  req.session.nonce = null;

  req.session.destroy(() => res.status(200).send(true));
});
