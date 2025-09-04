<?php
// Product selection dropdown
function renderProductDropdown() {
    echo '<select name="product" class="form-control">';
    echo '<option value="">Select a product</option>';
    echo '<option value="1">Temperature Sensor</option>';
    echo '<option value="2">Pressure Sensor</option>';
    echo '<option value="3">Humidity Sensor</option>';
    echo '<option value="4">Motion Sensor</option>';
    echo '<option value="5">Light Sensor</option>';
    echo '<option value="6">ACB &amp; GIS Current Transformer</option>';
    echo '<option value="7">Voltage Sensor</option>';
    echo '<option value="8">Power Meter</option>';
    echo '</select>';
}
?>