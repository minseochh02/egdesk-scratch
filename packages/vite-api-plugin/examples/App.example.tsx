import React, { useState, useEffect } from 'react';

/**
 * Helper to construct API URLs that work both locally and through EGDesk tunnel
 */
const apiUrl = (endpoint: string): string => {
  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  // Remove trailing slash from base
  const cleanBase = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL.slice(0, -1)
    : import.meta.env.BASE_URL;
  // Construct full path
  return `${cleanBase}${cleanEndpoint}`;
};

interface User {
  id: number;
  name: string;
  email: string;
}

interface Post {
  id: number;
  userId: number;
  title: string;
  content: string;
}

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, postsRes] = await Promise.all([
        fetch(apiUrl('api/users')),
        fetch(apiUrl('api/posts'))
      ]);

      if (!usersRes.ok || !postsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const usersData = await usersRes.json();
      const postsData = await postsRes.json();

      setUsers(usersData.users);
      setPosts(postsData.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Add new user
  const addUser = async () => {
    try {
      const response = await fetch(apiUrl('api/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `User ${users.length + 1}`,
          email: `user${users.length + 1}@example.com`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add user');
      }

      const data = await response.json();
      setUsers([...users, data.user]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    }
  };

  // Simulate data update
  const simulateUpdate = async () => {
    try {
      const response = await fetch(apiUrl('api/simulate-update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to update data');
      }

      // Refresh data
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
        <button
          onClick={fetchData}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Vite API Plugin Example</h1>

      <div className="mb-6 space-x-2">
        <button
          onClick={addUser}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add User
        </button>
        <button
          onClick={simulateUpdate}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          Simulate Update
        </button>
        <button
          onClick={fetchData}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Users Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Users ({users.length})</h2>
          <div className="space-y-2">
            {users.map(user => (
              <div key={user.id} className="p-4 bg-gray-100 rounded">
                <div className="font-semibold">{user.name}</div>
                <div className="text-sm text-gray-600">{user.email}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Posts Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Posts ({posts.length})</h2>
          <div className="space-y-2">
            {posts.map(post => (
              <div key={post.id} className="p-4 bg-gray-100 rounded">
                <div className="font-semibold">{post.title}</div>
                <div className="text-sm text-gray-600">{post.content}</div>
                <div className="text-xs text-gray-500 mt-1">
                  By User {post.userId}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold mb-2">Debug Info</h3>
        <div className="text-sm text-gray-700">
          <div>BASE_URL: {import.meta.env.BASE_URL}</div>
          <div>Example API URL: {apiUrl('api/users')}</div>
        </div>
      </div>
    </div>
  );
}

export default App;
