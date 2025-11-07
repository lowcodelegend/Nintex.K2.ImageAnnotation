# Modern Image Annotation Control for K2 SmartForms

A custom **SmartForms control** that wraps [Annotorious 3.x](https://annotorious.github.io/) so you can **draw, comment on, and delete annotations** directly on an image – fully wired into K2’s property, data binding, and event model.

This is a Modern K2 Form control which is an easy, standards compliant, web-component based approach to making Custom SmartForms controls.

---

## 📦 Installation (Manage Custom Controls → Add a Control)

You should download the "image-annotations.zip".

### 1. Upload via “Manage Custom Controls – Add a Control”

1. Open the **K2 Management** site in your browser.
2. Navigate to the Custom Controls section (names may vary slightly by version), e.g.:

   -  **Manage Custom Controls**, then  
   - Click **Add a Control**.

3. In the **Add Control** dialog:
   - Browse to and select your `image-annotation.zip`.
   - Confirm the control name and metadata from the manifest.
   - Complete the wizard to upload and register the control.

4. After a successful upload:
   - The control will appear in the **Custom Controls** list.
   - It will also be available in the **SmartForms Designer Toolbox** under the chosen category and `displayName` (e.g. *Image Annotation*).

---

### 3. Verify in SmartForms Designer

1. Open **SmartForms Designer**.
2. Create or edit a form.
3. In the Toolbox, find the **Image Annotation** control (under *Custom Controls* or your specified category).
4. Drag it onto the canvas.
5. Uncheck Readonly
6. Set the "Image Source URL" property to the location of an online available image to annotate.
7. Save and run the form to check that:
   - The image renders correctly.
   - You can draw rectangles.
   - The text popup and delete button behave as expected.

---

## 💡 How to Use the Control

### Properties

The manifest exposes at least these key properties:

- **Image Source URL** (`imageSourceUrl`)  
  The URL of the image to annotate (relative or absolute).

- **Value** (`Value`)  
  A JSON **string** containing an array of Web Annotation objects (internal `_value` is an array, exposed as JSON text for K2).

- Standard SmartForms properties:
  - **Width**
  - **Height**
  - **IsVisible**
  - **IsEnabled**
  - **IsReadOnly**
  - **DataBinding / ValuePropertyID** integration

### Runtime Behavior

At runtime the control:

1. Loads the image from **Image Source URL**.
2. Initializes Annotorious via `createImageAnnotator(...)`.
3. Lets the user:
   - Draw rectangular annotations over the image.
   - Select an annotation to see a **comment box** just below it.
   - Type text to attach a comment (`TextualBody` with `purpose: "commenting"`).
   - Select an annotation and click the **🗑️ delete button** in the bottom-right corner of the image to remove it.

### Data Shape (Value JSON)

The **Value** property contains JSON like:

```json
[
  {
    "id": "anno-1730891743000",
    "type": "Annotation",
    "target": {
      "selector": {
        "type": "FragmentSelector",
        "conformsTo": "http://www.w3.org/TR/media-frags/",
        "value": "xywh=pixel:30,40,120,100",
        "geometry": {
          "bounds": {
            "minX": 30,
            "minY": 40,
            "maxX": 150,
            "maxY": 140
          }
        }
      }
    },
    "bodies": [
      {
        "id": "anno-1730891743000-body-1",
        "purpose": "commenting",
        "value": "Scratch on surface"
      }
    ]
  }
]
```

You can store this in:

- A SmartObject memo/text field.
- A form parameter / view parameter.
- Any other `string`-type property in K2.

### Events

The manifest defines:

```json
"events": [
  {
    "id": "Changed",
    "friendlyname": "Value Changed"
  }
]
```

The control raises:

- `RaisedPropertyChanged(this, "Value")` when annotations change.
- A DOM event named **`"Changed"`** so rules like:
  > *When Image Annotation – Value Changed*  
  can be used to trigger workflows, calculations, or UI updates.

---

## 🧩 Example Real-World Scenario

### ✅ Defect Tagging in a QA Process

**Scenario:**

A manufacturing company has a **Quality Inspection** form. Inspectors review images of finished products and must record any defects clearly and visually.

**Using the Image Annotation Control:**

1. The form shows a product image with the **Image Annotation** control.
2. The inspector:
   - Draws rectangles around scratches, dents, or misaligned parts.
   - Types comments like *“scratch near label”* or *“missing screw”*.
3. When they submit the form:
   - The **Value** JSON (all regions + comments) is stored in a SmartObject.
   - The **Changed** event may kick off automated logic:
     - Flagging the item as failed.
     - Creating a work item for rework or investigation.
     - Sending the annotated image and JSON to downstream systems.

Later, supervisors can open the same form, rehydrate the `Value` into the control, and see the annotations rendered exactly where they were drawn.

---

## 🛠️ Hacking & Building with `npx`

The control is written as a standard ES module and then bundled for SmartForms.

### 1. Install Dependencies

In your local control development folder:

```bash
npm install @annotorious/annotorious
npm install --save-dev webpack webpack-cli
```

You should already have:

- `control.src.js` – the “source” version you edit.
- `control.js` – the built version referenced by the manifest.

### 2. Build / Rebuild with Webpack

Use `npx` so you don’t need a global install:

```bash
npx webpack ./control.src.js --mode=production --output-filename=./control.js
```

Then copy the control.js file from the dist/ sub-folder to the parent folder.

This:

- Bundles `control.src.js` and the Annotorious import.
- Outputs a minified `control.js` suitable for SmartForms runtime.

If you run into CSS loader issues for `annotorious.css`, don’t bundle it – just:

- Copy the `annotorious.css` file directly into the control folder.
- Reference it explicitly in `control.manifest.json`:

```json
"runtimeStyleFileNames": [
  "control.css",
  "annotorious.css"
]
```

### 3. Quick Local Test (Outside K2)

For fast iteration, you can test the web component in a plain HTML file:

```html
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="./annotorious.css" />
    <link rel="stylesheet" href="./control.css" />
  </head>
  <body>
    <script type="module" src="./control.js"></script>

    <image-annotation
      imageSourceUrl="test-image.jpg"
      style="width:600px; height:auto;">
    </image-annotation>
  </body>
</html>
```

Open `index.html` in your browser and verify:

- You can draw rectangles.
- The text popup appears under the selected rectangle.
- The bottom-right delete button works.
- Open DevTools and confirm the JSON in `Value` updates as expected.

When you’re happy with changes:

1. Rebuild with `npx webpack...`
2. Re-zip the control files.
3. Use **Manage Custom Controls → Add a Control** (or **Update** if your platform supports updating existing controls) to deploy the new version.

---


