#!/bin/bash
# Opens the ports the phone/tablet needs to reach this computer.
#
# Linux : uses ufw or firewalld, whichever is installed.
# macOS : the built-in firewall blocks per application, not per port, so this
#         allows the node binary instead.
#
# Needs sudo. The Windows equivalent is open-firewall.bat
# Usage: ./open-firewall.sh          (interactive)
#        ./open-firewall.sh quiet    (no prompts, used by install.sh)

set -e

PORTS="3000 3001 3443 3444"
QUIET="${1:-}"

echo "Opening ports: $PORTS"
echo "  3000 web http, 3001 api http, 3443 web https, 3444 api https"
echo ""

if [ "$(uname)" = "Darwin" ]; then
  FW="/usr/libexec/ApplicationFirewall/socketfilterfw"
  if [ ! -x "$FW" ]; then
    echo "Application firewall tool not found, nothing to do."
    exit 0
  fi

  STATE="$("$FW" --getglobalstate 2>/dev/null || true)"
  echo "Firewall state: $STATE"
  case "$STATE" in
    *disabled*)
      echo "The firewall is off, incoming connections are already allowed."
      echo "Nothing to do."
      exit 0
      ;;
  esac

  NODE_BIN="$(command -v node || true)"
  if [ -z "$NODE_BIN" ]; then
    echo "node not found in PATH, cannot add the rule."
    exit 1
  fi
  NODE_BIN="$(readlink -f "$NODE_BIN" 2>/dev/null || echo "$NODE_BIN")"

  echo "Allowing incoming connections for: $NODE_BIN"
  echo "You will be asked for your password."
  sudo "$FW" --add "$NODE_BIN" >/dev/null
  sudo "$FW" --unblockapp "$NODE_BIN" >/dev/null
  echo "  [ok] node is allowed to accept incoming connections"
  echo ""
  echo "To undo later:"
  echo "  sudo $FW --remove $NODE_BIN"
  exit 0
fi

# ---------- Linux ----------
if command -v ufw >/dev/null 2>&1; then
  echo "Using ufw. You will be asked for your password."
  for port in $PORTS; do
    sudo ufw allow "$port"/tcp >/dev/null
    echo "  [ok] port $port"
  done
  echo ""
  echo "To undo later:"
  for port in $PORTS; do
    echo "  sudo ufw delete allow $port/tcp"
  done
  exit 0
fi

if command -v firewall-cmd >/dev/null 2>&1; then
  echo "Using firewalld. You will be asked for your password."
  for port in $PORTS; do
    sudo firewall-cmd --permanent --add-port="$port"/tcp >/dev/null
    echo "  [ok] port $port"
  done
  sudo firewall-cmd --reload >/dev/null
  echo ""
  echo "To undo later:"
  for port in $PORTS; do
    echo "  sudo firewall-cmd --permanent --remove-port=$port/tcp"
  done
  echo "  sudo firewall-cmd --reload"
  exit 0
fi

echo "Neither ufw nor firewalld is installed."
echo "If this machine has no firewall, the ports are already reachable."
echo "Otherwise allow these TCP ports manually: $PORTS"
[ "$QUIET" = "quiet" ] || true
