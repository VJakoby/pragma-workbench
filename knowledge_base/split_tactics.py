import os
import re

def create_full_library():
    source = "master_tactics.txt"
    out_dir = "Service_Tactical_Guides"
    
    if not os.path.exists(source):
        print("[-] Error: master_tactics.txt not found.")
        return

    os.makedirs(out_dir, exist_ok=True)
    
    with open(source, "r", encoding="utf-8") as f:
        data = f.read()

    # Split using the SERVICE marker
    pattern = r'=== SERVICE: (\S+) ===\n(.*?)(?==== SERVICE:|\Z)'
    matches = re.findall(pattern, data, re.DOTALL)

    for slug, content in matches:
        filename = f"{slug.lower()}.md"
        with open(os.path.join(out_dir, filename), "w", encoding="utf-8") as out:
            out.write(content.strip())
        print(f"[+] Generated: {filename}")

    print(f"\n✅ SUCCESS: Generated {len(matches)} tactical files in '{out_dir}/'")

if __name__ == "__main__":
    create_full_library()
