'use client';

import { useState, useEffect } from "react";
import { Box, Typography, Modal, Grid, TextField, Button, IconButton, Card, CardMedia, CardContent, CardActions, Divider } from "@mui/material";
import { firestore, storage, auth } from "@/firebase";
import { collection, doc, getDocs, query, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { useRouter } from 'next/navigation'; // Import useRouter
import { onAuthStateChanged } from "firebase/auth";

export default function Home() {
  const [inventory, setInventory] = useState([]);
  const [open, setOpen] = useState(false);
  const [itemName, setItemName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [user, setUser] = useState(null); // State to hold user data
  const [username, setUsername] = useState('');

  const router = useRouter(); // Initialize the router

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // Fetch username from Firestore
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUsername(userDoc.data().username);
        }
      } else {
        setUsername('');
        setUser(null);
      }
    });

    // Fetch inventory when component mounts
    const fetchInventory = async () => {
      const snapshot = query(collection(firestore, "inventory"));
      const docs = await getDocs(snapshot);
      const inventoryList = [];
      docs.forEach((doc) => {
        inventoryList.push({
          name: doc.id,
          ...doc.data(),
        });
      });
      setInventory(inventoryList);
    };

    fetchInventory();

    return () => unsubscribe();
  }, []);

  const updateInventory = async () => {
    const snapshot = query(collection(firestore, "inventory"));
    const docs = await getDocs(snapshot);
    const inventoryList = [];
    docs.forEach((doc) => {
      inventoryList.push({
        name: doc.id,
        ...doc.data(),
      });
    });
    setInventory(inventoryList);
  };

  const removeItem = async (item) => {
    const docRef = doc(collection(firestore, 'inventory'), item);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const { count } = docSnap.data();
      await updateDoc(docRef, { count: count - 1 });
    }
    await updateInventory();
  };

  const addItem = async (item, file) => {
    if (!user) {
      alert("You must be logged in to post items.");
      return;
    }
  
    let imageUrl = '';
  
    if (file) {
      const storageRef = ref(storage, `images/${file.name}`);
      await uploadBytes(storageRef, file);
      imageUrl = await getDownloadURL(storageRef);
    }
  
    const docRef = doc(collection(firestore, 'inventory'), item);
    const docSnap = await getDoc(docRef);
  
    if (docSnap.exists()) {
      const { count } = docSnap.data();
      await updateDoc(docRef, { count: count + 1 });
    } else {
      await setDoc(docRef, {
        count: 1,
        imageUrl,
        username: username,  // Add username
        userId: user.uid      // Add userId here
      });
    }
    await updateInventory();
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  // LocalStorage helper functions
  const getUserLikes = () => {
    const likes = localStorage.getItem('userLikes');
    return likes ? JSON.parse(likes) : {};
  };

  const setUserLikes = (likes) => {
    localStorage.setItem('userLikes', JSON.stringify(likes));
  };

  const hasUserLiked = (itemName) => {
    const userLikes = getUserLikes();
    return userLikes[itemName] || false;
  };

  const addLike = (itemName) => {
    const userLikes = getUserLikes();
    userLikes[itemName] = true;
    setUserLikes(userLikes);
  };

  const removeLike = (itemName) => {
    const userLikes = getUserLikes();
    delete userLikes[itemName];
    setUserLikes(userLikes);
  };

  const handleLike = async (itemName) => {
    if (hasUserLiked(itemName)) {
      console.log('User already liked this item.');
      return;
    }

    addLike(itemName);

    // Update item count in your state
    const updatedInventory = inventory.map((item) =>
      item.name === itemName
        ? { ...item, count: item.count + 1 }
        : item
    );
    setInventory(updatedInventory);

    // Also update Firestore
    const docRef = doc(collection(firestore, 'inventory'), itemName);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const { count } = docSnap.data();
      await updateDoc(docRef, { count: count + 1 });
    }
  };

  const handleDislike = async (itemName) => {
    if (!hasUserLiked(itemName)) {
      console.log('User has not liked this item.');
      return;
    }

    removeLike(itemName);

    // Update item count in your state
    const updatedInventory = inventory.map((item) =>
      item.name === itemName
        ? { ...item, count: item.count - 1 }
        : item
    );
    setInventory(updatedInventory);

    // Also update Firestore
    const docRef = doc(collection(firestore, 'inventory'), itemName);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const { count } = docSnap.data();
      await updateDoc(docRef, { count: count - 1 });
    }
  };

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      sx={{ backgroundColor: '#f5f5f5', overflowY: 'auto', position: 'relative' }} // Enable scrolling and relative positioning
    >
      {/* Account Button */}
      <Button
        variant="outlined"
        color="primary"
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1
        }}
        onClick={() => router.push('/account')} // Navigate programmatically
      >
        Account
      </Button>

      <Typography variant="h2" color="primary" fontWeight="bold" gutterBottom>
        SnapShare
      </Typography>

      {user && (
        <Button onClick={handleOpen} variant="contained" color="primary" sx={{ marginBottom: 2 }}>
          Add a Post
        </Button>
      )}

      <Modal open={open} onClose={handleClose}>
        <Box
          position="absolute"
          top="50%"
          left="50%"
          width={400}
          bgcolor="white"
          borderRadius={2}
          boxShadow={24}
          p={4}
          display="flex"
          flexDirection="column"
          gap={2}
          sx={{ transform: 'translate(-50%, -50%)' }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Add Item</Typography>
            <IconButton onClick={handleClose} size="small">
              {/* Close Icon */}
            </IconButton>
          </Box>
          <TextField
            variant="outlined"
            fullWidth
            label="Item Name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files[0])}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              addItem(itemName, selectedFile);
              setItemName('');
              setSelectedFile(null);
              handleClose();
            }}
          >
            Add
          </Button>
        </Box>
      </Modal>
      
      <Box width="90%" maxWidth={1200} border="1px solid #ddd" borderRadius={4} p={2} bgcolor="white" boxShadow={2} overflow="auto">
        <Grid container spacing={2}>
          {inventory.map(({ name, count, imageUrl, username }) => (
            <Grid item xs={12} sm={6} md={4} key={name}>
              <Card sx={{ height: '100%' }}>
                {imageUrl && (
                  <CardMedia
                    component="img"
                    height="200"
                    image={imageUrl}
                    alt={name}
                    sx={{ objectFit: 'cover' }} // Ensure images cover the space without distortion
                  />
                )}
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {name}
                  </Typography>
                  <Typography variant="body1">
                    Likes: {count}
                  </Typography>
                  {username && (
                    <Typography variant="body2" color="textSecondary">
                      Posted by: {username}
                    </Typography>
                  )}
                </CardContent>
                <Divider />
                <CardActions>
                  <IconButton
                    color={hasUserLiked(name) ? 'primary' : 'default'}
                    onClick={() => handleLike(name)}
                  >
                    👍
                  </IconButton>
                  <IconButton
                    color={!hasUserLiked(name) ? 'secondary' : 'default'}
                    onClick={() => handleDislike(name)}
                  >
                    👎
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}
