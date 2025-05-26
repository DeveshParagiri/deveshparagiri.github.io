---
layout: post
title: Evaluating NDVI Based Tree Classification and Label Efficiency
date: 2025-05-26 16:00:00-0400
description:
tags: ai, research
categories: code
published: true
pretty_table: true
toc:
  sidebar: left
---

---

<br>
## **Overview**

This experiment investigates how accurately I can classify individual pixels in aerial imagery as **LIVE**, **DEAD**, or **BARE** ground using a small number of labeled examples. I assess how performance scales with label count and evaluate the benefit of using **NDVI** as an explicit input feature.

I try to answer three core questions:

1. How many labeled pixels per class are needed to achieve high accuracy?
2. Does adding NDVI to the input improve model performance?
3. Can a model trained on one year (2014) generalize to another (2020)?

---
<br>
## **Data and Setup**

- All pixels were extracted from spectrally and spatially normalized NAIP imagery (2014–2022).
- Manual labels were created by visually inspecting .png previews across years for each sampled coordinate.
- Each labeled pixel was represented using either:
    - **4-band spectral input**: Red, Green, Blue, NIR
    - **5-band input**: Red, Green, Blue, NIR, NDVI

The model used in all experiments is a RandomForestClassifier from sklearn.

---
<br>
## **Experiment 1: Accuracy vs Label Count (With and Without NDVI)**

I trained the classifier using only labeled pixels from **2014**. For each value of k (samples per class), I ran 5 randomized 80/20 train-test splits and recorded mean accuracy and standard deviation.

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/label_efficiency_and_generalization/accuracy_simple.png" class="img-fluid rounded z-depth-1" zoomable=true caption="Accuracy vs Label Count (Without NDVI)" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/label_efficiency_and_generalization/accuracy_ndvi.png" class="img-fluid rounded z-depth-1" zoomable=true caption="Accuracy vs Label Count (With NDVI)" %}
    </div>
</div>

### **Results Summary**

| **Labeled/Class (k)** | **Accuracy (w/o NDVI)** | **Accuracy (w/ NDVI)** |
| --- | --- | --- |
| 5 | ~52% ± high variance | ~74% ± lower variance |
| 8 | ~65% | ~77% |
| 13 | ~75% | **~85%** |

In the first experiment, I found that adding NDVI to the input significantly improves model performance, especially at low sample counts.
<br>
##### **Key Takeaways:**

- NDVI significantly boosts accuracy, especially at **low sample counts**
- Including NDVI stabilizes model performance across random splits
- Without NDVI, the model struggles to distinguish classes under limited supervision
- With NDVI, LIVE pixels are often learned with high confidence even with 5–6 examples

---
<br>
## **Experiment 2: Cross-Year Generalization (Train on 2014 → Test on 2020)**

I trained a model on all 2014-labeled pixels (using 5-band input with NDVI) and tested it directly on labeled pixels from 2020 — no retraining or adaptation.

**Results:**

- **Overall Accuracy**: **78.4%**
- **LIVE** class had high precision and recall
- **BARE** was consistently predicted correctly (recall = 1.0), though with some over-prediction
- **DEAD** remained harder to capture (recall = 0.53)

```
Classification Report:
              precision    recall  f1-score
    BARE         0.571     1.000     0.727
    DEAD         0.818     0.529     0.643
    LIVE         0.885     0.885     0.885
```

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/label_efficiency_and_generalization/confusion_2014to2020.png" class="img-fluid rounded z-depth-1" zoomable=true caption="Confusion Matrix" %}
    </div>
</div>


---
<br>
## **Implications**

- **NDVI improves generalization** by providing a vegetation-specific signal that remains valid across years.
- The model is most confident on **LIVE** pixels, suggesting that greenness + NDVI are strong predictors.
- **DEAD** and **BARE** are more difficult to distinguish — these likely require:
    - More training samples
    - Spatial or temporal context (e.g., adjacent pixels, change over time)

---
<br>
## **Conclusions**

- Based on this experiment, with as few as **10–13 labeled pixels per class**, we can reach **>85% accuracy** using NDVI.
- Training on one year and applying to another is feasible if the data is normalized.
- NDVI should be included as a feature — it boosts performance significantly and reduces label burden.

---
<br>
## **Next Steps**

- Increase label count across years
- Test reverse generalization: 2020 → 2014
- Predict full raster maps using trained models
- Potentially Add 3×3 or 5×5 patch-based context around each pixel