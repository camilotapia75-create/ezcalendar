# ezcalendar — native iOS app (Capacitor) + Instagram/Facebook share

This wraps the deployed web app in a native iOS shell so you can:
1. Ship to the App Store, and
2. Add ezcalendar to the **iOS share sheet** — share an Instagram/Facebook post
   straight into the app (the one thing a PWA fundamentally can't do on iOS).

The native app just loads your live site (`server.url` in `capacitor.config.ts`),
so **web changes keep shipping without rebuilding the app.** Only native bits
(the Share Extension) need Xcode.

---

## Prerequisites (one-time)
- A **Mac** with **Xcode** installed.
- An **Apple Developer account** ($99/yr) — required for a Share Extension + App Store.
- Node installed (you already have it).

## 1. Install Capacitor + add iOS
From the repo root on your Mac:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/app
npx cap add ios
```

## 2. Point the app at your live site
Edit `capacitor.config.ts` → set `server.url` to your real production domain
(e.g. `https://ezcalendar.vercel.app`). Then:
```bash
npx cap sync ios
npx cap open ios   # opens Xcode
```
At this point you have a working native app that loads your web app. Run it on a
simulator/device to confirm.

## 3. Register the URL scheme (so the extension can open the app)
In Xcode → the **App** target → **Info** → URL Types → add one:
- **URL Schemes:** `ezcalendar`

## 4. App Group (shared storage between app + extension)
In Xcode, for **both** the App target and (next step) the Share Extension target:
- **Signing & Capabilities → + Capability → App Groups**
- Add a group, e.g. `group.com.ezcalendar.app`

## 5. Add the Share Extension target
Xcode → **File → New → Target… → Share Extension**. Name it `ShareToEzcalendar`.
Give it the same App Group as step 4. Set its **Info.plist** activation rules so it
appears for links (and optionally images):

```xml
<key>NSExtensionActivationRule</key>
<dict>
  <key>NSExtensionActivationSupportsWebURLWithMaxCount</key><integer>1</integer>
  <key>NSExtensionActivationSupportsText</key><true/>
  <key>NSExtensionActivationSupportsImageWithMaxCount</key><integer>1</integer>
</dict>
```

Replace the generated `ShareViewController.swift` with this — it grabs the shared
URL (Instagram/Facebook share a post link) and opens the main app via the
`ezcalendar://` scheme, which the web app already handles:

```swift
import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    handleShare()
  }

  func handleShare() {
    guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
          let providers = item.attachments else { return complete() }

    for provider in providers {
      // A shared web link (what Instagram/Facebook put on the share sheet)
      if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
        provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { (data, _) in
          if let url = data as? URL { self.openApp(with: url.absoluteString) }
          else { self.complete() }
        }
        return
      }
      // Or plain text that contains a link
      if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
        provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { (data, _) in
          if let text = data as? String,
             let match = text.range(of: #"https?://[^\s]+"#, options: .regularExpression) {
            self.openApp(with: String(text[match]))
          } else { self.complete() }
        }
        return
      }
    }
    complete()
  }

  func openApp(with sharedUrl: String) {
    let encoded = sharedUrl.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
    if let deep = URL(string: "ezcalendar://scan?url=\(encoded)") {
      // Open the containing app from an extension
      var responder: UIResponder? = self
      while let r = responder {
        if let app = r as? UIApplication {
          app.perform(#selector(UIApplication.openURL(_:)), with: deep)
          break
        }
        responder = r.next
      }
    }
    complete()
  }

  func complete() {
    DispatchQueue.main.async {
      self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
  }
}
```

> Note: sharing an **image** (rather than a link) is a bigger lift — the extension
> would write the image into the App Group container and the web layer would read
> it. Start with **link sharing** above: it's exactly what Instagram/Facebook put
> on the share sheet, and it maps straight into the existing scan flow.

## 6. The web side is already wired
When the extension opens `ezcalendar://scan?url=…`, the app receives it via the
`@capacitor/app` `appUrlOpen` event. `CalendarClient` already listens for this
(guarded so it's a no-op on the web) and opens the scan modal with that URL — the
same path as the PWA's `?scan=` share target. Nothing else to build.

## 7. Build & submit
- Set the app icon/splash (Xcode assets), bump the version, and archive.
- Submit via App Store Connect. Share Extensions are reviewed with the app.

---

### TL;DR of what's already done for you
- `capacitor.config.ts` (set your `server.url`).
- `CalendarClient` handles the `ezcalendar://scan?url=…` deep link.
- The web scan flow (`?scan=`) already turns a shared URL into a scan.

What's left is Mac-only: `npx cap add ios`, the App Group, the Share Extension
target + the Swift above, and App Store submission.
