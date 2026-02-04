```text
  ____________ _____   ____  _   _ _____ ____________ _____  
 |___  /  ____|  __ \ / __ \| \ | |_   _|___  /  ____|  __ \ 
    / /| |__  | |__) | |  | |  \| | | |    / /| |__  | |__) |
   / / |  __| |  _  /| |  | | . ` | | |   / / |  __| |  _  / 
  / /__| |____| | \ \| |__| | |\  |_| |_ / /__| |____| | \ \ 
 /_____|______|_|  \_\\____/|_| \_|_____/_____|______|_|  \_\
                                                    
```

# Zeronizer

## What it does
Zeronizer scans a selected Figma component (or component set) and finds static `0` values in auto layout spacing/padding fields.  
It then binds those fields to the `semantic/size/0` variable so spacing tokens are applied consistently.

## Install guide
1. Download this repository.
2. In Figma, go to **Plugins** -> **Development** -> **Import plugin from manifest...**
3. Select `manifest.json` from this folder.
4. The plugin is now available in Figma under **Plugins**.
