# 📂 SMB (Port 445)
### ⚡ Quick Wins
- [ ] **Null Session:** `nxc smb <IP> -u '' -p '' --shares`
- [ ] **Vuln Check:** `nmap -p 445 --script smb-vuln-ms17-010 <IP>`
* [ ] **List Shares:** `smbclient -L //<IP> -N`
* [ ] **Check Permissions:** `smbmap -H <IP>`
* [ ] **User Enum:** `enum4linux -a <IP>`

### Common Ports
* **139:** NetBIOS Session Service (Older)
* **445:** Microsoft-DS (Modern)

### 🚀 Exploitation
- **Relay:** `ntlmrelayx.py -tf targets.txt -smb2support`
* **Null Sessions:** Check if login without password is allowed.
* **Vulnerabilities:** `nmap --script smb-vuln* -p 139,445 <IP>`