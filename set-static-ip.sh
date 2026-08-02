#!/bin/bash
# Give this computer a fixed IP address on the local network.
#
# Why: the phone bookmarks http://<ip>:3000, and the HTTPS certificate is bound
# to that IP. If the router hands out a different address later, both stop
# working.
#
# macOS : uses networksetup
# Linux : uses nmcli (NetworkManager)
#
# Needs sudo. The Windows equivalent is set-static-ip.bat
# Usage: ./set-static-ip.sh          set a static address
#        ./set-static-ip.sh revert   go back to automatic (DHCP)

set -e

MODE="${1:-set}"

mask_to_prefix() {
  local mask="$1" prefix=0 octet
  for octet in ${mask//./ }; do
    case "$octet" in
      255) prefix=$((prefix + 8)) ;;
      254) prefix=$((prefix + 7)) ;;
      252) prefix=$((prefix + 6)) ;;
      248) prefix=$((prefix + 5)) ;;
      240) prefix=$((prefix + 4)) ;;
      224) prefix=$((prefix + 3)) ;;
      192) prefix=$((prefix + 2)) ;;
      128) prefix=$((prefix + 1)) ;;
      0) ;;
      *) echo "24"; return ;;
    esac
  done
  echo "$prefix"
}

confirm() {
  local answer=""
  read -r -p "Type YES to continue: " answer
  if [ "$answer" != "YES" ]; then
    echo "Cancelled, nothing was changed."
    exit 1
  fi
}

# ===================== macOS =====================
if [ "$(uname)" = "Darwin" ]; then
  echo "============================================"
  echo "  Network services on this computer"
  echo "============================================"
  echo ""
  networksetup -listallnetworkservices | tail -n +2
  echo ""
  read -r -p "Service name (copy it exactly from the list above): " SERVICE
  [ -z "$SERVICE" ] && { echo "Nothing entered, aborting."; exit 1; }

  echo ""
  echo "Current settings of \"$SERVICE\":"
  networksetup -getinfo "$SERVICE"

  if [ "$MODE" = "revert" ]; then
    echo ""
    echo "This will set \"$SERVICE\" back to automatic (DHCP)."
    confirm
    sudo networksetup -setdhcp "$SERVICE"
    sudo networksetup -setdnsservers "$SERVICE" empty
    echo ""
    networksetup -getinfo "$SERVICE"
    echo ""
    echo "Back to automatic."
    exit 0
  fi

  echo ""
  echo "IMPORTANT: pick an address that is"
  echo "  - in the same range as the current one (e.g. 192.168.1.x)"
  echo "  - OUTSIDE the router's automatic range, or reserved in the router"
  echo "  - not already used by another device"
  echo ""

  read -r -p "  Fixed IP address (e.g. 192.168.1.200): " NEW_IP
  [ -z "$NEW_IP" ] && { echo "Cancelled."; exit 1; }
  read -r -p "  Subnet mask [255.255.255.0]: " MASK
  MASK="${MASK:-255.255.255.0}"
  read -r -p "  Gateway (your router, e.g. 192.168.1.1): " GATEWAY
  [ -z "$GATEWAY" ] && { echo "Cancelled."; exit 1; }
  read -r -p "  Primary DNS [$GATEWAY]: " DNS1
  DNS1="${DNS1:-$GATEWAY}"
  read -r -p "  Secondary DNS [223.5.5.5]: " DNS2
  DNS2="${DNS2:-223.5.5.5}"

  echo ""
  echo "============================================"
  echo "  Confirm"
  echo "============================================"
  echo "  Service : $SERVICE"
  echo "  IP      : $NEW_IP"
  echo "  Mask    : $MASK"
  echo "  Gateway : $GATEWAY"
  echo "  DNS     : $DNS1 , $DNS2"
  echo ""
  echo "The network will drop for a few seconds while this is applied."
  confirm

  sudo networksetup -setmanual "$SERVICE" "$NEW_IP" "$MASK" "$GATEWAY"
  sudo networksetup -setdnsservers "$SERVICE" "$DNS1" "$DNS2"

  echo ""
  echo "New settings:"
  networksetup -getinfo "$SERVICE"

  echo ""
  echo "Testing the connection to the router..."
  if ping -c 2 -t 3 "$GATEWAY" >/dev/null 2>&1; then
    echo "  [ok] Router reachable."
  else
    echo "  [WARNING] Cannot reach the gateway $GATEWAY."
    echo "  Run ./set-static-ip.sh revert to go back to automatic."
  fi

  echo ""
  echo "Done. On the phone open: http://$NEW_IP:3000"
  echo "Remember to re-run ./create-cert.sh so the certificate covers the new IP."
  exit 0
fi

# ===================== Linux =====================
if ! command -v nmcli >/dev/null 2>&1; then
  echo "nmcli (NetworkManager) is not installed."
  echo "Set the fixed IP with your distribution's own network tool instead."
  exit 1
fi

echo "============================================"
echo "  Active connections"
echo "============================================"
echo ""
nmcli -t -f NAME,DEVICE,TYPE connection show --active | sed 's/:/  |  /g'
echo ""
read -r -p "Connection name (copy it exactly from the list above): " CONN
[ -z "$CONN" ] && { echo "Nothing entered, aborting."; exit 1; }

echo ""
echo "Current settings of \"$CONN\":"
nmcli connection show "$CONN" | grep -E "ipv4.method|ipv4.addresses|ipv4.gateway|ipv4.dns:" || true

if [ "$MODE" = "revert" ]; then
  echo ""
  echo "This will set \"$CONN\" back to automatic (DHCP)."
  confirm
  sudo nmcli connection modify "$CONN" ipv4.method auto ipv4.addresses "" ipv4.gateway "" ipv4.dns ""
  sudo nmcli connection up "$CONN" >/dev/null
  echo ""
  echo "Back to automatic."
  exit 0
fi

echo ""
echo "IMPORTANT: pick an address that is"
echo "  - in the same range as the current one (e.g. 192.168.1.x)"
echo "  - OUTSIDE the router's automatic range, or reserved in the router"
echo "  - not already used by another device"
echo ""

read -r -p "  Fixed IP address (e.g. 192.168.1.200): " NEW_IP
[ -z "$NEW_IP" ] && { echo "Cancelled."; exit 1; }
read -r -p "  Subnet mask [255.255.255.0]: " MASK
MASK="${MASK:-255.255.255.0}"
PREFIX="$(mask_to_prefix "$MASK")"
read -r -p "  Gateway (your router, e.g. 192.168.1.1): " GATEWAY
[ -z "$GATEWAY" ] && { echo "Cancelled."; exit 1; }
read -r -p "  Primary DNS [$GATEWAY]: " DNS1
DNS1="${DNS1:-$GATEWAY}"
read -r -p "  Secondary DNS [223.5.5.5]: " DNS2
DNS2="${DNS2:-223.5.5.5}"

echo ""
echo "============================================"
echo "  Confirm"
echo "============================================"
echo "  Connection : $CONN"
echo "  IP         : $NEW_IP/$PREFIX"
echo "  Gateway    : $GATEWAY"
echo "  DNS        : $DNS1 , $DNS2"
echo ""
echo "The network will drop for a few seconds while this is applied."
confirm

sudo nmcli connection modify "$CONN" \
  ipv4.method manual \
  ipv4.addresses "$NEW_IP/$PREFIX" \
  ipv4.gateway "$GATEWAY" \
  ipv4.dns "$DNS1 $DNS2"
sudo nmcli connection up "$CONN" >/dev/null

echo ""
echo "New settings:"
nmcli connection show "$CONN" | grep -E "ipv4.method|ipv4.addresses|ipv4.gateway|ipv4.dns:" || true

echo ""
echo "Testing the connection to the router..."
if ping -c 2 -W 3 "$GATEWAY" >/dev/null 2>&1; then
  echo "  [ok] Router reachable."
else
  echo "  [WARNING] Cannot reach the gateway $GATEWAY."
  echo "  Run ./set-static-ip.sh revert to go back to automatic."
fi

echo ""
echo "Done. On the phone open: http://$NEW_IP:3000"
echo "Remember to re-run ./create-cert.sh so the certificate covers the new IP."
