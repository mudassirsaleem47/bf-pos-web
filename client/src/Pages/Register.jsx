import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const errorText = await response.text();
        console.error('Server non-JSON response:', errorText);
        throw new Error(`Server Error (non-JSON): ${errorText.substring(0, 150)}`);
      }

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      navigate('/login');
    } catch (err) {
      setError(err.message || 'Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 360 }}>
        <Card sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                BF Makeup
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Create an account
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Full Name"
                name="name"
                variant="standard"
                autoComplete='off'
                required
                fullWidth
                size="small"
                value={formData.name}
                onChange={handleChange}
              />

              <TextField
                label="Email"
                variant="standard"
                type="email"
                name="email"
                autoComplete='off'
                required
                fullWidth
                size="small"
                value={formData.email}
                onChange={handleChange}
              />

              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                variant="standard"
                name="password"
                autoComplete='off'
                required
                fullWidth
                size="small"
                value={formData.password}
                onChange={handleChange}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOff sx={{ fontSize: 20 }} /> : <Visibility sx={{ fontSize: 20 }} />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
              />

              <Button
                type="submit"
                disabled={loading}
                variant="contained"
                fullWidth
              >
                {loading ? 'Submitting...' : 'Register'}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Already have an account?
              </Typography>
              <Typography
                component={Link}
                to="/login"
                variant="caption"
                sx={{ color: '#1976d2', textDecoration: 'none', fontWeight: 'bold' }}
              >
                Login
              </Typography>
            </Box>
          </form>
        </Card>
      </Box>
    </Box>
  );
};

export default Register;
