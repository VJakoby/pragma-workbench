# 📂 SMB / SAMBA (Port 139/445)

### 1. Enumeration
* [ ] **List Shares:** `smbclient -L //<IP> -N`
* [ ] **Check Permissions:** `smbmap -H <IP>`
* [ ] **User Enum:** `enum4linux -a <IP>`

### 2. Common Ports
* **139:** NetBIOS Session Service (Older)
* **445:** Microsoft-DS (Modern)

### 3. Exploitation
* **Null Sessions:** Check if login without password is allowed.
* **Vulnerabilities:** `nmap --script smb-vuln* -p 139,445 <IP>`