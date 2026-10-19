### Where is the data?

Nowhere on the server. Worksheets are generated in each visitor's browser, autosaved in that browser (`localStorage`), and can be exported as `.json` files. Backups of this app therefore only contain the static program files and the nginx configuration. Remind users to export worksheets they care about.

### Default paper size

The paper size chosen at install time (US Letter or A4) is the default for *new* worksheets; everyone can still switch per worksheet. To change it:

```bash
sudo yunohost app setting __APP__ default_paper -v a4     # or: letter
sudo yunohost app upgrade __APP__ --force                  # rewrites config.json
```

### Public or private

By default the app is open to visitors. Since it stores nothing server-side this is safe, but you can restrict it to YunoHost users in the webadmin (*Users → Manage groups and permissions*).

### Offline use and upgrades

The app registers a service worker so that it keeps working without a network. After an upgrade, open the app once (or reload) to pick up the new version.
