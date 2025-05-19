---
layout: post
title: Detecting Tree Mortality from Aerial Imagery
date: 2025-05-18 16:00:00-0400
description:
tags: ai, research
categories: code
published: true
pretty_table: true
toc:
  sidebar: left
---
---

## **Log 1: DeepForest Approach**
<br>

### **Research Question**

How can we reliably detect **tree mortality** across time using **aerial imagery**? Can **pretrained object detection models**, like **DeepForest**, give us useful indicators of **tree health or death**?

---
<br>
### **Phase 1 Approach — Using DeepForest for Crown Detection**

DeepForest is a state-of-the-art deep learning model trained on RGB imagery to detect **individual tree crowns**. It outputs **bounding boxes** around tree-like objects, which initially seemed promising for analyzing:

- **Tree count changes over time**
- **Tree canopy shrinkage**
- Mortality via **absence or degradation** of detected crowns

---
<br>

### **Thought Process**

Use a pretrained model to:

- Quickly extract structured detections
- Use **bounding box count or size** as a proxy for forest density
- Detect **tree loss trends over time** without training from scratch

---
<br>
### **Methodology**

- **Imagery Source:** NAIP (2014–2022), 512×512 RGB tiles, resolution: 1.0m → 0.6m
- **Tool:** [`DeepForest`](https://github.com/weecology/DeepForest)
- **Workflow:**
    - Load NAIP tile
    - Predict bounding boxes using pretrained model
    - Compare box count and coverage across years

```python
from deepforest import main
model = main.deepforest()
model.use_release()
boxes = model.predict_image(path="naip_tile.png", return_plot=True)
```

---

<br>
### **Sample Outputs**

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/research_log/log1.png" class="img-fluid rounded z-depth-1" zoomable=true caption="DeepForest detection results before parameter tuning" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/research_log/log1-2.png" class="img-fluid rounded z-depth-1" zoomable=true caption="DeepForest detection results after parameter tuning" %}
    </div>
</div>

---
<br>
### **Challenges Encountered**
<br>
##### 1. **Spatial Resolution Mismatch**
- DeepForest was trained on ~0.1m resolution. NAIP tiles at 1.0m/0.6m were **too coarse**.
- Crowns were **blurry**, often **undetected or merged** into clusters.

##### 2. **Bounding Boxes ≠ Tree Area**
- Boxes were **not calibrated** to actual canopy area.
- Detection size and count varied erratically due to visual artifacts.

##### 3. **Noisy Temporal Consistency**
- Detections fluctuated due to shadows, season, sun angle — **not ecological change**.
- Trees "disappeared" or "reappeared" randomly between years.

---
<br>

### **Summary**


| Metric | Result |
| --- | --- |
| Visual Interpretability | ❌ Low |
| Spatial Precision | ❌ Weak |
| Temporal Consistency | ❌ Unusable |

---
<br>

### **Key Takeaways**

- Pretrained models are **domain-constrained**
- Tree detection ≠ mortality inference
- **RGB-only features are too volatile** over time

---

<br>
### **Transition to Next Phase**

We needed a strategy focused on **semantic labeling** (LIVE / DEAD / BARE), not detection. This led to the **5x5 patch-based classification** approach — covered next in **Log 2**.

---

<br>
## **Log 2: Patch-Based Classification**

<br>
### **Research Goal**

Label small regions of aerial imagery based on **ecological intuition**, using spatial patches instead of pixel-level or bounding box classification.

---
<br>
### **Phase 2 Approach — 5×5 Patch Labeling Using Human Intuition**

Each 512×512 tile was divided into a 5×5 grid (i.e. ~25×25 pixel patches). Each patch was visually labeled based on **dominant appearance**: LIVE, DEAD, or BARE.

---
<br>
### **Thought Process**

- Smoother than pixel classification
- Easier than labeling full tiles
- Provides enough context for human labeling (e.g., sparse vs dense canopy)

---
<br>
### **Methodology**

##### 1. **Patch Generation**

- Each tile → ~100+ 5×5 patches
- Recorded in `valid_patches.csv`:
    
    ```
    r329_c58_y2020.png, 329, 58, 2020, , possibly BARE or DEAD
    ```
    

##### 2. **Visual Labeling**

- No NDVI or thresholding
- Labels were assigned via:
    - Manual inspection across years
    - Texture, color, and shape
    - "Hint" labels updated during review

##### 3. **Model Training**

- Feature extraction:
    - RGB stats (mean, std)
    - Optional raw pixel flattening
- Classifier:
    - Random Forest (baseline)
    - Small MLP (later)

---

<br>
### **Sample Outputs**

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/research_log/log2-1.png" class="img-fluid rounded z-depth-1" zoomable=true caption="Sample patch labeling" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/research_log/log2-2.png" class="img-fluid rounded z-depth-1" zoomable=true caption="Area of Interest" %}
    </div>
</div>

<div class="row mt-3">
    <div class="col-12 mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/research_log/log2-3.png" class="img-fluid rounded z-depth-1" zoomable=true caption="Dead Tree Area Over Time" %}
    </div>
</div>

<div class="row mt-3">
    <div class="col-12 mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/research_log/log2-4.png" class="img-fluid rounded z-depth-1" zoomable=true caption="Transition Matrices for 5x5 Patch Classification" %}
    </div>
</div>

---

<br>
### **Challenges Encountered**
<br>

##### 1. **Labeling Conflicts (Majority Dilemma)**

- Mixed-content patches (e.g., half LIVE, half DEAD)
- Label assignment was subjective → high variance

##### 2. **Spectral Inconsistency**

- Same class in different years looked different (due to sensors, lighting)
- Model trained on one year **couldn't generalize** to another

##### 3. **Spatial Drift**

- Misalignments between years → same patch ID pointed to **different physical areas**
- Resolution changes (1m vs 0.6m) broke equivalence

---

<br>
### **Summary**

| Metric | Result |
| --- | --- |
| In-year Accuracy | ~65–70% |
| Cross-year Generalization | ❌ Failed (<50%) |
| Label Noise | High |

---
<br>
### **Key Takeaways**

- **Visual labeling ≠ repeatable** at scale
- Patches blur meaningful distinctions
- Spectral models must **anchor on spatial precision**
- RGB features alone cannot reliably detect long-term changes

---

<br>
### **Transition to Next Phase**

To resolve both spectral and spatial instability, we transitioned to **pixel-level temporal modeling** — tracking **individual pixels across all years**. That's the focus of **Log 3**.

---
<br>
## **Log 3: Single Pixel Temporal Classification**

<br>
### **Research Goal**

Track **individual pixels** over time and use their **temporal NDVI trajectories** to classify them into ecological categories (LIVE, DEAD, BARE).

---
<br>
### **Phase 3 Approach — Per-Pixel Temporal NDVI Classifier**

We moved away from patches and bounding boxes entirely. Each pixel became its own data point, tracked across all available years.

---

<br>
### **Thought Process**

- Control exact **spatial location**
- Use **temporal signal** as primary feature (e.g., NDVI over time)
- Detect transitions like LIVE → DEAD or DEAD → BARE
- Label using **human-in-the-loop hints** supported by NDVI

---

<br>
### **Methodology**

##### 1. **Pixel Extraction**

- Spatially aligned tiles across years (2014–2022)
- Pixels indexed by `row`, `col`
- Each pixel assigned time-series NDVI values:
    
    ```
    filename,row,col,year,ndvi,label_hint
    r327_c59_y2020.png,327,59,2020,0.162,"possibly BARE or DEAD"
    
    ```
    

##### 2. **Labeling Strategy**

- Combined:
    - Visual inspection across years
    - NDVI pattern (e.g., drop then flatten)
    - Human-annotated hints like "likely DEAD"

##### 3. **Model Input**

- Each training sample: NDVI vector across years
    
    ```
    [0.58 (2014), 0.56 (2016), 0.44 (2018), 0.23 (2020), 0.22 (2022)]
    → label: DEAD
    ```
    

---

<br>
### **Sample Outputs**



<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/research_log/raw_buffer_2014.png" class="img-fluid rounded z-depth-1" zoomable=true caption="Raw Buffer 2014" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/research_log/matched_buffer_2014.png" class="img-fluid rounded z-depth-1" zoomable=true caption="Spectrally Matched Buffer 2014" %}
    </div>
</div>

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/research_log/log3-2.png" class="img-fluid rounded z-depth-1" zoomable=true caption="Vegetation Reflectance Drift" %}
    </div>
</div>

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/research_log/log3-1.png" class="img-fluid rounded z-depth-1" zoomable=true caption="Single Pixel Time Series" %}
    </div>
</div>
---

<br>
### **Key Strengths**

- True **temporal stability** — fixed pixel over time
- Model can **learn transitions**, not just snapshot classes
- Eliminates resolution-induced mapping drift

---

<br>
### **Experimental Insights**

- Temporal modeling removes much spatial noise
- NDVI change patterns (drop + flatten) correlate well with true mortality
- Model interpretability improves (you can "see" what happened)

---

<br>
### **Current Status**

| Metric | Result |
| --- | --- |
| Temporal NDVI consistency | ✅ Strong |
| Human label quality | ✅ High confidence |
| Class balance | ⚠️ Still tuning |
| Next step | Expand labeled samples & train temporal classifier |

---