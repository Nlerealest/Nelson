# Nelson app (Android)

A phone app for the Nelson XAUUSD bot. It shows your account and today's result, Nelson's open trades and orders, a live gold chart with liquidity levels and entry/stop/target lines, Nelson's market read (structure, liquidity, order flow, news), and the full journal. From the app you can pause or resume Nelson, change the risk per trade, and close every trade.

Nelson keeps running on the VPS. The app is the remote control, so closing the app or switching off the phone doesn't stop the bot. Trade alerts while the app is closed come through Telegram (see `nelson-bot/README.md`).

## 1. Install the APK

Every push that changes `nelson-app/` builds a new APK on GitHub.

1. On your phone, open **https://github.com/Nlerealest/Nelson/releases** while logged in to GitHub.
2. Open the newest **Nelson app** release and tap the `.apk` file.
3. Android asks to allow installs from your browser. Allow it, then tap **Install**.

Updates install over the old version, and your connection is kept.

## 2. Connect the app to Nelson

The app talks to a small private API inside Nelson. Nobody else should be able to reach it, so publish it with **Tailscale**, a free private network between your own devices:

1. Install Tailscale on the **VPS** (tailscale.com/download, Windows) and on your **phone** (Play Store). Log in with the same account on both.
2. On the VPS, give Nelson's API an https address that only your devices can open:
   ```bash
   tailscale serve --bg 8765
   ```
   It prints an address like `https://my-vps.tail1234.ts.net`.
3. Create the app key and QR code:
   ```bash
   python run_nelson.py app-setup --url https://my-vps.tail1234.ts.net
   ```
   Copy the `app:` lines it prints into `config.yaml` and restart Nelson.
4. In the app, tap **Scan QR code** and point the camera at the QR on the VPS screen. You can also type the address and key in.

Keep Tailscale switched on on your phone. The key is stored encrypted on the phone. Anyone with the key can pause Nelson or close its trades, so don't share it.

## 3. Try it first with the demo

You can try the app before MT5 is set up. On any computer on the same Wi-Fi as your phone, run:

```bash
cd nelson-bot
python run_nelson.py demo
```

In the app, use the address `http://<that computer's IP>:8765` and the key `nelson-demo-key-not-for-real-trading`. The demo replays **practice prices** (not the real market) quickly, with relaxed rules so you see trades open and close.

## For developers

```bash
cd nelson-app
npm install
npm test            # pure logic tests
npx expo lint
npx expo start      # dev server; the camera and secure storage need a development build
```

The APK is built by `.github/workflows/nelson-apk.yml` with `expo prebuild` and Gradle. The release build is signed with the project's standard debug key, which is fine for installing your own app. If you later publish to the Play Store, build with EAS (`eas.json`, `npx eas-cli@latest build -p android --profile production`), which manages a proper upload key.
