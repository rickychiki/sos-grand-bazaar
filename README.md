# STORY OF SEASONS: Grand Bazaar - Interactive Recipe Mind Map

This project is an **interactive mind map** for the game **STORY OF SEASONS: Grand Bazaar**, showing recipes, ingredients, processed goods, and groups.

The project is **MIT licensed**. See the `LICENSE` file for details.

---

## Features

### 1️⃣ Node Interaction
- **Ingredients node**: Click to display all recipes and processed goods that can be made from it, as well as the group it belongs to.  
- **Processed goods node**: Click to show original ingredients, recipes that can be made from it, and its group.  
- **Group node**: Click to reveal all members, and the recipes and processed goods associated with them.  
- **Recipe node**: Click to show all required ingredients.

### 2️⃣ Links
- **Purple**: Points to a group  
- **Black**: Points to a recipe  
- **Red / Blue / Yellow**: Points to a processed good (color depends on the corresponding windmill processing)  
- **Green**: Points to a upgraded recipe

### 3️⃣ Node Colors
- **Purple**: Group  
- **Gray**: Recipe  
- **Red / Blue / Yellow**: Processed goods (based on windmill type)  
- **Green**: ingredients

### 4️⃣ Special Interactions
- Without filters, **double-click a node** to show additional connections.  
- Clicking a **recipe node** shows **extra ingredients**.
- Clicking a **non-recipe node** shows **which recipes can use this as extra ingredients**.

### 5️⃣ Filters
- **Trending / Effect / Category**: Only the nodes related to the selected filter are displayed.  
  - **Trending nodes** are highlighted with a **red and thicker border**.  
  - Only the trending nodes themselves are highlighted.  
  - Related recipes or materials are displayed normally without any highlight.
- **Season filter**: Nodes that are not relevant to the selected season will appear **faded** to help focus on the relevant items.

### 6️⃣ Tooltip Information
Hovering over a node shows additional details:  
- **Price** (all nodes)  
- **Craft time** (processed goods)  
- **Effect** (recipes)  
- **Grow time in days** (crops)  
- **Yield** (crops)  
- **Crop type** (crops)  
- **Season emoji** (ingredients)  
- **Trending emoji** (trending nodes)

### 7️⃣ Multi-language Support
- Supports multiple languages for all node labels and interface elements.

---

## Disclaimer

- This project **does not include any images or copyrighted materials** from Marvelous Inc.  
- All visual elements (nodes, links, text) are **created dynamically by the code**.  
- This mind map is for **educational and reference purposes only**, and is **not affiliated with or endorsed by Marvelous Inc.**  