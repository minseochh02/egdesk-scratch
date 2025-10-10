<?php
/**
 * Gmail Data API Server
 * Provides REST API access to Gmail data stored in SQLite database
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database configuration - try multiple possible paths
$possiblePaths = [
    $_GET['db_path'] ?? null,
    '/Users/minseocha/Library/Application Support/egdesk/database/conversations.db',
    '/Users/minseocha/Library/Application Support/egdesk-scratch (development)/database/conversations.db',
    '/Users/minseocha/Library/Application Support/egdesk-scratch/database/conversations.db',
    '/Users/minseocha/Library/Application Support/Electron/database/conversations.db',
    './database/conversations.db',
    '../database/conversations.db'
];

$dbPath = null;
foreach ($possiblePaths as $path) {
    if ($path && file_exists($path)) {
        $dbPath = $path;
        break;
    }
}

if (!$dbPath) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Database file not found',
        'tried_paths' => array_filter($possiblePaths),
        'suggestion' => 'Please start the Electron app and use the Gmail Dashboard at least once to initialize the database tables.'
    ]);
    exit();
}

$db = null;
try {
    // Connect to SQLite database
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit();
}

// Get the request method and endpoint
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($path, '/'));

// Remove the script name from path parts
if (isset($pathParts[0]) && $pathParts[0] === basename($_SERVER['SCRIPT_NAME'])) {
    array_shift($pathParts);
}

// Route handling
try {
    switch ($method) {
        case 'GET':
            handleGetRequest($db, $pathParts);
            break;
        case 'POST':
            handlePostRequest($db, $pathParts);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

function handleGetRequest($db, $pathParts) {
    if (empty($pathParts)) {
        // Root endpoint - show API info
        echo json_encode([
            'api' => 'Gmail Data API',
            'version' => '1.0.0',
            'endpoints' => [
                'GET /users' => 'Get all domain users',
                'GET /users/{email}/messages' => 'Get messages for a user',
                'GET /users/{email}/stats' => 'Get stats for a user',
                'GET /stats' => 'Get database statistics'
            ]
        ]);
        return;
    }

    switch ($pathParts[0]) {
        case 'users':
            if (isset($pathParts[1])) {
                $userEmail = $pathParts[1];
                if (isset($pathParts[2])) {
                    switch ($pathParts[2]) {
                        case 'messages':
                            getUserMessages($db, $userEmail);
                            break;
                        case 'stats':
                            getUserStats($db, $userEmail);
                            break;
                        default:
                            http_response_code(404);
                            echo json_encode(['error' => 'Endpoint not found']);
                            break;
                    }
                } else {
                    getUser($db, $userEmail);
                }
            } else {
                getAllUsers($db);
            }
            break;
        case 'stats':
            getDatabaseStats($db);
            break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint not found']);
            break;
    }
}

function handlePostRequest($db, $pathParts) {
    // Handle POST requests for data updates
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($pathParts[0]) {
        case 'sync':
            // Trigger data sync (placeholder for future implementation)
            echo json_encode(['message' => 'Sync endpoint - not implemented yet']);
            break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint not found']);
            break;
    }
}

function getAllUsers($db) {
    try {
        $stmt = $db->prepare("SELECT * FROM domain_users ORDER BY email ASC");
        $stmt->execute();
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Convert boolean fields
        foreach ($users as &$user) {
            $user['is_admin'] = (bool)$user['is_admin'];
            $user['is_suspended'] = (bool)$user['is_suspended'];
        }
        
        echo json_encode([
            'success' => true,
            'count' => count($users),
            'users' => $users
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch users: ' . $e->getMessage()]);
    }
}

function getUser($db, $email) {
    try {
        $stmt = $db->prepare("SELECT * FROM domain_users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user) {
            $user['is_admin'] = (bool)$user['is_admin'];
            $user['is_suspended'] = (bool)$user['is_suspended'];
            
            echo json_encode([
                'success' => true,
                'user' => $user
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch user: ' . $e->getMessage()]);
    }
}

function getUserMessages($db, $email) {
    try {
        $limit = $_GET['limit'] ?? 50;
        $offset = $_GET['offset'] ?? 0;
        
        $stmt = $db->prepare("
            SELECT * FROM gmail_messages 
            WHERE user_email = ? 
            ORDER BY date DESC 
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$email, $limit, $offset]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Convert boolean fields and parse labels
        foreach ($messages as &$message) {
            $message['is_read'] = (bool)$message['is_read'];
            $message['is_important'] = (bool)$message['is_important'];
            $message['labels'] = json_decode($message['labels'], true);
        }
        
        echo json_encode([
            'success' => true,
            'count' => count($messages),
            'user_email' => $email,
            'messages' => $messages
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch messages: ' . $e->getMessage()]);
    }
}

function getUserStats($db, $email) {
    try {
        $stmt = $db->prepare("SELECT * FROM gmail_stats WHERE user_email = ? ORDER BY updated_at DESC LIMIT 1");
        $stmt->execute([$email]);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($stats) {
            echo json_encode([
                'success' => true,
                'user_email' => $email,
                'stats' => $stats
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Stats not found for user']);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch stats: ' . $e->getMessage()]);
    }
}

function getDatabaseStats($db) {
    try {
        $stats = [];
        
        // Get user count
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM domain_users");
        $stmt->execute();
        $stats['total_users'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        
        // Get message count
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM gmail_messages");
        $stmt->execute();
        $stats['total_messages'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        
        // Get stats count
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM gmail_stats");
        $stmt->execute();
        $stats['total_stats'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        
        // Get last updated
        $stmt = $db->prepare("SELECT MAX(updated_at) as last_updated FROM gmail_messages");
        $stmt->execute();
        $stats['last_updated'] = $stmt->fetch(PDO::FETCH_ASSOC)['last_updated'];
        
        echo json_encode([
            'success' => true,
            'database_stats' => $stats
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch database stats: ' . $e->getMessage()]);
    }
}
?>