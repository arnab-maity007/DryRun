# DryRun

**DryRun** is a VS Code extension designed specifically for Competitive Programmers and DSA learners. It brings your code to life by visualizing its execution step by step, helping you understand complex logic, debug tricky edge cases, and visualize data structures intuitively—right inside your editor.

---

## Features

- **Step by Step Visualization**: Watch your code execute line by line. The editor dynamically highlights the current executing statement and keeps track of your execution path.
- **Rich Memory Rendering**: Variables aren't just text. DryRun visually renders scalars, arrays, vectors, maps, sets, stacks, and queues.
- **Call Stack Tracking**: Easily trace recursive functions. The call stack visually builds up as deep recursive calls are made and collapses as they return.
- **Multi-Language Support**: Seamlessly visualizes code in **C++**, **Python**, and **Java**.
- **Interactive Controls**: Step backward or forward at your own pace, or hit 'Play' to watch the execution flow smoothly with an adjustable speed slider.
- **Custom Input (Stdin)**: Provide custom input via the built-in "Run" button and input textarea.
- **Graph Visualization (Python)**: Automatic dynamic graph generation for Trees, Linked Lists, and generic graphs.

---

## How to run 
The extension isnt launched at production yet . Although you can run it locally . 
1. Clone the repo in your desktop 
2. Open the folder in VS Code.
3. Press F5 (or Fn+F5 on Mac). It will open a new Extension Development Host window.
4. Open the C++, Python, or Java file you want to debug.
5. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac), search for `DryRun: Start Visualizer` and press Enter.
6. A visualization panel will pop up on the right. Enter any custom input needed and click 'Run'. 

---
##  Supported Data Structures

DryRun goes beyond basic variables. It automatically formats and renders:
- **Primitives**: `int`, `float`, `double`, `string`, `bool`, `char`
- **1D/2D Arrays & Vectors / Lists**
- **Maps / Dictionaries**
- **Sets**
- **Stacks** (Vertical visualization with a `top` pointer)
- **Queues** (Horizontal visualization with `front` and `back` pointers)
- **Trees & Graphs** (Python custom objects currently)

---

## Release Notes

### v2.0.0 (DryRun v2)
- Complete UI rewrite natively integrated with VS Code panels.
- Multi-language engine support for C++, Python, and Java.
- Support for advanced data structures (Maps, Sets, Stacks, Queues, Graphs).
- Interactive step-back and visual Delta Flashes.
- Error catching and custom stdin input.

---
**Will meet with updated and strong versions soon**
