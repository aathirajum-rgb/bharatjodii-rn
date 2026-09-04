# Expo HAS CHANGED

This project is on Expo SDK 57 (check `package.json`'s `"expo"` version — that's
the source of truth, not this file). Read the versioned docs matching that
exact SDK major version at https://docs.expo.dev/versions/v57.0.0/ before
writing any code.

This file previously pointed at v56 docs while the project had already moved
to SDK 57 — package.json and the installed dependencies were correct, but
package-lock.json had drifted out of sync and this file was never updated
either. If the SDK version is bumped again, update the URL above (and verify
package-lock.json actually matches package.json — run a plain `npm install`
and check `git diff package-lock.json` for unexpected drift like this).
