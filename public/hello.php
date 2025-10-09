<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$response = [
    'message' => 'Hello from PHP server!',
    'timestamp' => date('Y-m-d H:i:s'),
    'php_version' => phpversion(),
    'method' => $_SERVER['REQUEST_METHOD'],
    'path' => $_SERVER['REQUEST_URI']
];

echo json_encode($response, JSON_PRETTY_PRINT);
?>