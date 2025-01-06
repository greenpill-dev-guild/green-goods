export default async function handler(req, res) {
  if (req.method === "POST") {
    const { email } = req.body;

    const mailchimpUrl = `https://app.us13.list-manage.com/subscribe/post?u=16db3a1a92dd56e81459cd500&id=c6c12d1a3f&f_id=0021fae1f0`;

    const data = new URLSearchParams();
    data.append("EMAIL", email);
    data.append("b_16db3a1a92dd56e81459cd500_c6c12d1a3f", ""); // hidden input to prevent bot signups

    try {
      const response = await fetch(mailchimpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: data.toString(),
      });

      if (response.ok) {
        res
          .status(200)
          .json({ success: true, message: "Subscription successful!" });
      } else {
        res
          .status(response.status)
          .json({ success: false, message: "Subscription failed." });
      }
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
