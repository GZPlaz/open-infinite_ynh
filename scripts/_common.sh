#!/bin/bash

#=================================================
# COMMON VARIABLES AND CUSTOM HELPERS
#=================================================

# OpenInfinite is static: no service, no database, no build step on the server.

# Write config.json (defaults read by the app at startup) from the app settings.
_write_site_config() {
    ynh_config_add --template="config.json" --destination="$install_dir/config.json"
}

# Owned by the app's system user, readable by nginx, nothing for others.
_set_permissions() {
    chown -R "$app:www-data" "$install_dir"
    find "$install_dir" -type d -exec chmod 750 {} +
    find "$install_dir" -type f -exec chmod 640 {} +
}
