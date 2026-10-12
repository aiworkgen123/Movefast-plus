#!/bin/bash
# Mr Truth Studio - installs the website on a fresh Ubuntu 24.04 server (DigitalOcean, Hetzner, Vultr...).
# Paste this in the server's console (as root); it asks for the GitHub token without showing it:
#   read -s -p "GitHub token: " T; echo; curl -fsSL -H "Authorization: token $T" https://raw.githubusercontent.com/aiworkgen123/Movefast-plus/mrtruth-web/web/install.sh -o install.sh && GH_TOKEN=$T bash install.sh
# Running it again later is safe: it updates the code and keeps your films, people and keys.
set -euo pipefail
REPO=${REPO:-aiworkgen123/Movefast-plus}
BRANCH=${BRANCH:-mrtruth-web}
APP=/opt/mrtruth
DATA=/var/lib/mrtruth
SVC=mrtruth
[ "$(id -u)" = 0 ] || { echo "Run this as root (the server console logs you in as root)."; exit 1; }
if [ -z "${GH_TOKEN:-}" ]; then read -r -s -p "GitHub token (read-only): " GH_TOKEN; echo; fi

echo "== 1/6 system packages (a few minutes the first time)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv python3-pip git ffmpeg caddy ufw curl ca-certificates >/dev/null
if [ "$(free -m | awk '/Mem/{print $2}')" -lt 1900 ] && ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 2/6 the tool's own user and folders"
id $SVC >/dev/null 2>&1 || useradd --system --home-dir $APP --shell /usr/sbin/nologin $SVC
mkdir -p $APP $DATA && chown $SVC:$SVC $APP $DATA && chmod 700 $DATA

echo "== 3/6 the code"
CRED=$APP/.git-credentials
printf 'https://x-access-token:%s@github.com\n' "$GH_TOKEN" > $CRED && chmod 600 $CRED && chown $SVC:$SVC $CRED
if [ -d $APP/code/.git ]; then
  sudo -u $SVC git -C $APP/code pull -q --ff-only
else
  sudo -u $SVC git -c credential.helper="store --file=$CRED" clone -q --depth 30 -b "$BRANCH" "https://github.com/$REPO.git" $APP/code
fi
sudo -u $SVC git -C $APP/code config credential.helper "store --file=$CRED"
echo "   $(sudo -u $SVC git -C $APP/code log -1 --format='%h %cs %s')"

echo "== 4/6 Python"
[ -x $APP/venv/bin/python ] || sudo -u $SVC python3 -m venv $APP/venv
sudo -u $SVC $APP/venv/bin/pip install -q --upgrade pip >/dev/null
sudo -u $SVC $APP/venv/bin/pip install -q flask==3.1.2 requests==2.32.5 gunicorn==23.0.0 python-dotenv==1.1.1

echo "== 5/6 your sign-in"
cd $APP/code
if ! sudo -u $SVC MRTRUTH_WEB_DATA=$DATA $APP/venv/bin/python -m web.manage people | grep -q ' owner'; then
  read -r -p "Your sign-in name (for example your first name, lowercase): " OWNER
  sudo -u $SVC MRTRUTH_WEB_DATA=$DATA $APP/venv/bin/python -m web.manage add-owner "$OWNER"
fi

echo "== 6/6 web address and secure connection"
IP=$(curl -s -4 -m 10 https://api.ipify.org || hostname -I | awk '{print $1}')
FREE="${IP//./-}.sslip.io"
OLD=$(head -1 /etc/caddy/Caddyfile 2>/dev/null | awk '/\{$/{print $1}')
read -r -p "Your web address (e.g. studio.yourname.com), or Enter for ${OLD:-$FREE}: " DOMAIN
DOMAIN=${DOMAIN:-${OLD:-$FREE}}
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:8080 {
		transport http {
			read_timeout 30m
			write_timeout 30m
		}
	}
}
CADDY
cat > /etc/systemd/system/$SVC-web.service <<UNIT
[Unit]
Description=Mr Truth Studio (website)
After=network-online.target
Wants=network-online.target

[Service]
User=$SVC
WorkingDirectory=$APP/code
Environment=MRTRUTH_WEB_DATA=$DATA
Environment=MRTRUTH_WEB_HTTPS=1
ExecStart=$APP/venv/bin/gunicorn -w 1 --threads 16 --timeout 1800 -b 127.0.0.1:8080 web.app:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable -q --now $SVC-web
systemctl restart $SVC-web caddy
ufw allow OpenSSH >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && ufw --force enable >/dev/null
sleep 3
if curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/ | grep -q 200; then
  echo
  echo "Done. Open:  https://$DOMAIN"
  echo "(the secure certificate can take a minute the first time)"
  [ "$DOMAIN" = "$FREE" ] && echo "Using your own address later: point it at $IP, then run this installer again and type it."
else
  echo "The website did not start. Show this to Claude:"; journalctl -u $SVC-web -n 30 --no-pager
fi
