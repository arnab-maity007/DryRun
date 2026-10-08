# DryRun

**DryRun** is a VS Code extension designed specifically for Competitive Programmers and DSA learners. It brings your code to life by visualizing its execution step by step, helping you understand complex logic, debug tricky edge cases, and visualize data structures intuitively—right inside your editor.

---

## Features

- **Step by Step Visualization**: Watch your code execute line by line. The editor dynamically highlights the current executing statement and keeps track of your execution path.
- **Rich Memory Rendering**: Variables aren't just text. DryRun visually renders scalars, arrays, vectors, maps, sets, stacks, and queues.
- **Call Stack Tracking**: Easily trace recursive functions. The call stack visually builds up as deep recursive calls are made and collapses as they return.
- **Multi-Language Support**: Currently it supports only **C++** but will add support of other languages soon.
- **Interactive Controls**: Step backward or forward at your own pace, or hit 'Play' to watch the execution flow smoothly with an adjustable speed slider.

---

## How to run 
The extension isnt launched at production yet . Although you can run it locally . 
1. Clone the repo in your dekstop 
2. press f5 , if on mac press fn+f5 , it will open you a new window . open the c++ file you want to debug.
3. press ctrl+shift+P , if in mac then cmd+shift+P 
4. dry run will pop up on the right of your laptop . use it and let us know the bugs :D . 

---
##  Supported Data Structures

DryRun goes beyond basic variables. It automatically formats and renders:
- **Primitives**: `int`, `float`, `double`, `string`, `bool`, `char`
- **1D/2D Arrays & Vectors / Lists**
- **Maps / Dictionaries**
- **Sets**
- **Stacks** (Vertical visualization with a `top` pointer)
- **Queues** (Horizontal visualization with `front` and `back` pointers)

---

## Release Notes

### v0.0.1 (Version-0)
- Initial preview release of DryRun.
- Core interpreter engine for C++.
- Support for complex data structures (Maps, Sets, Stacks, Queues).
- Interactive playback controls and F5 debugging compatibility.

---
**Will meet with updated and strong versions soon**
