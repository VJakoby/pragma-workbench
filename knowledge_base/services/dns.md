# 🗺️ DNS (Port 53)
### ⚡ Quick Wins
- [ ] **Zone Transfer:** `dig axfr @<DNS_IP> <DOMAIN>`
- [ ] **Version:** `dig chaos txt version.bind @<IP>`

### 🔍 Enumeration
- **Subdomains:** `dnsrecon -d <DOMAIN> -n <DNS_IP>`