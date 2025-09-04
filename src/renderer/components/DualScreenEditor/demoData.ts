import { AIEdit, AIEditResponse } from '../AIEditor/types';

// Demo file content for www/index.php
export const demoFileContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Product Selection</title>
</head>
<body>
    <form id="productForm">
        <h1>Product Selection</h1>
        
        <div class="form-group">
            <label for="productType">Select Product Type:</label>
            <select id="productType" name="productType" onchange="showSubCategories(this.value)">
                <option value="0" selected="select">Product</option>
                <option value="1">Solid CTs for Metering &amp; monitoring</option>
                <option value="2">Split-core CTs</option>
                <option value="3">Zero Phase CT</option>
                <option value="4">Rogowski Coils</option>
                <option value="5">Smart Meters</option>
                <option value="6">ACB &amp; GIS Current Transformer</option>
                <option value="7">Test Option</option>
            </select>
        </div>

        <div class="form-group">
            <label for="subCategory">Sub Category:</label>
            <select id="subCategory" name="subCategory">
                <option value="">Please select a product type first</option>
            </select>
        </div>

        <div class="sub-categories">
            <select id="SUB0" name="SUB0" style="display: none;">
                <option value="">Select Product Subcategory</option>
                <option value="basic">Basic Product</option>
                <option value="premium">Premium Product</option>
            </select>

            <select id="SUB1" name="SUB1" style="display: none;">
                <option value="">Select Solid CT Type</option>
                <option value="single-phase">Single Phase</option>
                <option value="three-phase">Three Phase</option>
            </select>

            <select id="SUB2" name="SUB2" style="display: none;">
                <option value="">Select Split-core CT Type</option>
                <option value="standard">Standard</option>
                <option value="high-accuracy">High Accuracy</option>
            </select>

            <select id="SUB3" name="SUB3" style="display: none;">
                <option value="">Select Zero Phase CT</option>
                <option value="compact">Compact</option>
                <option value="industrial">Industrial</option>
            </select>

            <select id="SUB4" name="SUB4" style="display: none;">
                <option value="">Select Rogowski Coil</option>
                <option value="flexible">Flexible</option>
                <option value="rigid">Rigid</option>
            </select>

            <select id="SUB5" name="SUB5" style="display: none;">
                <option value="">Select Smart Meter</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
            </select>

            <select id="SUB6" name="SUB6" style="display: none;">
                <option value="">Select ACB & GIS CT</option>
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
            </select>
        </div>

        <button type="submit">Submit</button>
    </form>

    <script>
        function showSubCategories(obj) {
            var f = document.getElementById('productForm');
            
            if (obj == 1) {
                f.SUB0.style.display = "none";
                f.SUB1.style.display = "";
                f.SUB2.style.display = "none";
                f.SUB3.style.display = "none";
                f.SUB4.style.display = "none";
                f.SUB5.style.display = "none";
                f.SUB6.style.display = "none";
            } else if (obj == 2) {
                f.SUB0.style.display = "none";
                f.SUB1.style.display = "none";
                f.SUB2.style.display = "";
                f.SUB3.style.display = "none";
                f.SUB4.style.display = "none";
                f.SUB5.style.display = "none";
                f.SUB6.style.display = "none";
            } else if (obj == 3) {
                f.SUB0.style.display = "none";
                f.SUB1.style.display = "none";
                f.SUB2.style.display = "none";
                f.SUB3.style.display = "";
                f.SUB4.style.display = "none";
                f.SUB5.style.display = "none";
                f.SUB6.style.display = "none";
            } else if (obj == 4) {
                f.SUB0.style.display = "none";
                f.SUB1.style.display = "none";
                f.SUB2.style.display = "none";
                f.SUB3.style.display = "none";
                f.SUB4.style.display = "";
                f.SUB5.style.display = "none";
                f.SUB6.style.display = "none";
            } else if (obj == 5) {
                f.SUB0.style.display = "none";
                f.SUB1.style.display = "none";
                f.SUB2.style.display = "none";
                f.SUB3.style.display = "none";
                f.SUB4.style.display = "none";
                f.SUB5.style.display = "";
                f.SUB6.style.display = "none";
            } else if (obj == 6) {
                f.SUB0.style.display = "none";
                f.SUB1.style.display = "none";
                f.SUB2.style.display = "none";
                f.SUB3.style.display = "none";
                f.SUB4.style.display = "none";
                f.SUB5.style.display = "none";
                f.SUB6.style.display = "";
            } else if (obj == 7) { // Added for the new Test Option
                f.SUB0.style.display = "";
                f.SUB1.style.display = "none";
                f.SUB2.style.display = "none";
                f.SUB3.style.display = "none";
                f.SUB4.style.display = "none";
                f.SUB5.style.display = "none";
                f.SUB6.style.display = "none";
            } else if (obj == 0) {
                f.SUB0.style.display = "";
                f.SUB1.style.display = "none";
                f.SUB2.style.display = "none";
                f.SUB3.style.display = "none";
                f.SUB4.style.display = "none";
                f.SUB5.style.display = "none";
                f.SUB6.style.display = "none";
            }
        }
    </script>
</body>
</html>`;

// Demo AI Edit Response with the search/replace operations you provided
export const demoAIEditResponse: AIEditResponse = {
  success: true,
  edits: [
    {
      type: 'replace',
      filePath: 'www/index.php',
      range: {
        start: 0,
        end: 0,
        startLine: 53,
        endLine: 61,
        startColumn: 1,
        endColumn: 1
      },
      oldText: `<option value="0" selected="select">Product</option>
                                        <option value="1">Solid CTs for Metering &amp; monitoring</option>
                                        <option value="2">Split-core CTs</option>
                                        <option value="3">Zero Phase CT</option>
                                        <option value="4">Rogowski Coils</option>
                                        <option value="5">Smart Meters</option>
                                        <option value="6">ACB &amp; GIS Current Transformer</option>
                                        <option value="7">Test Option</option>`,
      newText: `<option value="0" selected="select">Product</option>
                                        <option value="1">Solid CTs for Metering &amp; monitoring</option>
                                        <option value="2">Split-core CTs</option>
                                        <option value="3">Zero Phase CT</option>
                                        <option value="4">Rogowski Coils</option>
                                        <option value="5">Smart Meters</option>
                                        <option value="6">ACB &amp; GIS Current Transformer</option>
                                        <option value="7">Test Option</option>
                                        <option value="8">New Product Category</option>`,
      description: 'Add new product category option to the dropdown'
    },
    {
      type: 'replace',
      filePath: 'www/index.php',
      range: {
        start: 0,
        end: 0,
        startLine: 163,
        endLine: 180,
        startColumn: 1,
        endColumn: 1
      },
      oldText: `f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";

                            } else if (obj == 7) { // Added for the new Test Option

                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";

                            } else if (obj == 0) {

                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";`,
      newText: `f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";

                            } else if (obj == 7) { // Added for the new Test Option

                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";

                            } else if (obj == 8) { // Added for the new product category

                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";

                            } else if (obj == 0) {

                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";`,
      description: 'Add handling for new product category (obj == 8) in JavaScript function'
    }
  ],
  explanation: `I've made the following changes to your product selection form:

1. **Added new product category option**: Added "New Product Category" as option value 8 in the main dropdown
2. **Updated JavaScript logic**: Added handling for the new product category (obj == 8) in the showSubCategories function

These changes will allow users to select the new product category and the JavaScript will properly show/hide the appropriate subcategory dropdowns.`,
  usage: {
    promptTokens: 150,
    completionTokens: 200,
    totalTokens: 350
  }
};

// Demo current file data
export const demoCurrentFile = {
  path: 'www/index.php',
  name: 'index.php',
  content: demoFileContent,
  language: 'php'
};

// Demo project context
export const demoProjectContext = {
  currentProject: {
    path: '/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch',
    name: 'EGDesk-scratch'
  },
  availableFiles: [
    {
      path: 'www/index.php',
      name: 'index.php',
      content: demoFileContent,
      language: 'php'
    }
  ]
};

// Demo route files
export const demoRouteFiles = [
  {
    path: 'www/index.php',
    name: 'index.php',
    content: demoFileContent,
    language: 'php'
  }
];

// Function to create demo data for testing
export const createDemoData = () => {
  return {
    currentFile: demoCurrentFile,
    projectContext: demoProjectContext,
    routeFiles: demoRouteFiles,
    aiResponse: demoAIEditResponse
  };
};

// Function to simulate AI response with search/replace operations
export const createDemoAIResponse = (): AIEditResponse => {
  return {
    success: true,
    edits: [
      {
        type: 'replace',
        filePath: 'www/index.php',
        range: {
          start: 0,
          end: 0,
          startLine: 53,
          endLine: 61,
          startColumn: 1,
          endColumn: 1
        },
        oldText: `<option value="0" selected="select">Product</option>
                                        <option value="1">Solid CTs for Metering &amp; monitoring</option>
                                        <option value="2">Split-core CTs</option>
                                        <option value="3">Zero Phase CT</option>
                                        <option value="4">Rogowski Coils</option>
                                        <option value="5">Smart Meters</option>
                                        <option value="6">ACB &amp; GIS Current Transformer</option>
                                        <option value="7">Test Option</option>`,
        newText: `<option value="0" selected="select">Product</option>
                                        <option value="1">Solid CTs for Metering &amp; monitoring</option>
                                        <option value="2">Split-core CTs</option>
                                        <option value="3">Zero Phase CT</option>
                                        <option value="4">Rogowski Coils</option>
                                        <option value="5">Smart Meters</option>
                                        <option value="6">ACB &amp; GIS Current Transformer</option>
                                        <option value="7">Test Option</option>
                                        <option value="8">New Product Category</option>`,
        description: 'Add new product category option to the dropdown'
      },
      {
        type: 'replace',
        filePath: 'www/index.php',
        range: {
          start: 0,
          end: 0,
          startLine: 163,
          endLine: 180,
          startColumn: 1,
          endColumn: 1
        },
        oldText: `f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";

                            } else if (obj == 7) { // Added for the new Test Option

                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";

                            } else if (obj == 0) {

                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";`,
        newText: `f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";

                            } else if (obj == 7) { // Added for the new Test Option

                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";

                            } else if (obj == 8) { // Added for the new product category

                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";

                            } else if (obj == 0) {

                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";`,
        description: 'Add handling for new product category (obj == 8) in JavaScript function'
      }
    ],
    explanation: `I've made the following changes to your product selection form:

1. **Added new product category option**: Added "New Product Category" as option value 8 in the main dropdown
2. **Updated JavaScript logic**: Added handling for the new product category (obj == 8) in the showSubCategories function

These changes will allow users to select the new product category and the JavaScript will properly show/hide the appropriate subcategory dropdowns.`,
    usage: {
      promptTokens: 150,
      completionTokens: 200,
      totalTokens: 350
    }
  };
};

// Function to test the diff UI with demo data
export const testDiffUI = () => {
  console.log('🧪 Testing Diff UI with Demo Data');
  console.log('📁 Demo File:', demoCurrentFile);
  console.log('🔍 Demo AI Response:', demoAIEditResponse);
  console.log('📊 Demo Edits Count:', demoAIEditResponse.edits.length);
  
  return {
    currentFile: demoCurrentFile,
    aiResponse: demoAIEditResponse,
    projectContext: demoProjectContext,
    routeFiles: demoRouteFiles
  };
};
