**⚠️ This Figma plugin only works with Designsystemet Community file ⚠️**
```text
  ____________ _____   ____  _   _ _____ ____________ _____  
 |___  /  ____|  __ \ / __ \| \ | |_   _|___  /  ____|  __ \ 
    / /| |__  | |__) | |  | |  \| | | |    / /| |__  | |__) |
   / / |  __| |  _  /| |  | | . ` | | |   / / |  __| |  _  / 
  / /__| |____| | \ \| |__| | |\  |_| |_ / /__| |____| | \ \ 
 /_____|______|_|  \_\\____/|_| \_|_____/_____|______|_|  \_\
                                                    
```


## What it does
Zeronizer finds static `0` values in auto layout spacing/padding fields and binds them to the `semantic/size/0` variable.

You can run it in two modes:
- **Zeronize selection (fast):** scans one selected component or component set.
- **Zeronize whole file (slower):** scans all pages and processes components across the file (with configured page exclusions).

Rules:
- Only works on components/component sets.
- Instance nodes are skipped.
- Already-bound variable fields are ignored.

## Install guide
1. Download this repository.
2. In Figma, go to **Plugins** -> **Development** -> **Import plugin from manifest...**
3. Select `manifest.json` from this folder.
4. The plugin is now available in Figma under **Plugins**.
