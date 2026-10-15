#!/usr/bin/env bash
# One-time (and update) setup for the ChumGPT lab stream on a fresh Ubuntu 24.04 or Debian 12 server.
# Run from the cloned repo:   sudo bash coins/chumgpt/stream/setup.sh
# Re-running it updates the stream files and restarts the service. Your /etc/chumstream.env is kept.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }

SRC="$(cd "$(dirname "$0")" && pwd)"          # .../coins/chumgpt/stream
APP=/opt/chumstream
ENVF=/etc/chumstream.env
export DEBIAN_FRONTEND=noninteractive

echo "== packages"
apt-get update -qq
apt-get install -y -qq xvfb xdotool pulseaudio hsetroot ffmpeg nodejs fonts-dejavu-core ca-certificates curl unattended-upgrades >/dev/null

echo "== browser (Google Chrome, held at the installed version so updates never surprise the stream)"
if ! command -v google-chrome >/dev/null; then
  curl -fsSL -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  apt-get install -y -qq /tmp/chrome.deb >/dev/null && rm -f /tmp/chrome.deb
fi
apt-mark hold google-chrome-stable >/dev/null

node -e 'const [a]=process.versions.node.split(".").map(Number); if(a<18){console.error("Node 18+ needed, found "+process.versions.node);process.exit(1)}'

echo "== user and files"
id chum >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/chum --shell /usr/sbin/nologin chum
mkdir -p "$APP"
rm -rf "$APP/stream.new" "$APP/kit.new"
cp -r "$SRC" "$APP/stream.new"; cp -r "$SRC/../kit" "$APP/kit.new"
rm -rf "$APP/stream" "$APP/kit"; mv "$APP/stream.new" "$APP/stream"; mv "$APP/kit.new" "$APP/kit"
chown -R root:root "$APP"; chmod -R a+rX "$APP"

if [ ! -f "$ENVF" ]; then
  cp "$SRC/chumstream.env.example" "$ENVF"
  echo "   created $ENVF - put your RTMP URL and stream key in there"
fi
chown root:chum "$ENVF"; chmod 640 "$ENVF"

echo "== safety nets"
# 2 GB swap so a memory spike slows things down instead of killing the stream
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi
# logs can never fill the disk
mkdir -p /etc/systemd/journald.conf.d
printf "[Journal]\nSystemMaxUse=300M\n" > /etc/systemd/journald.conf.d/chumstream.conf
systemctl restart systemd-journald
# security updates yes, surprise reboots no
printf 'Unattended-Upgrade::Automatic-Reboot "false";\n' > /etc/apt/apt.conf.d/51chumstream-noreboot

echo "== service"
install -m 644 "$SRC/chumstream.service" /etc/systemd/system/chumstream.service
systemctl daemon-reload
systemctl enable chumstream >/dev/null
systemctl restart chumstream
sleep 20
if curl -fsS http://127.0.0.1:8090/health >/dev/null; then
  echo "== ON AIR. Health:"; curl -s http://127.0.0.1:8090/health
else
  echo "== started, but not healthy yet. Check: journalctl -u chumstream -n 80"
  curl -s http://127.0.0.1:8090/health || true
fi
