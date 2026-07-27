import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link as MuiLink,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { apiClient } from '../api/client';
import type { Collection } from '../api/types';
import { getAuth0Config } from '../auth/config';
import { logout } from '../auth/logout';

export function Collections(): ReactElement {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<Collection | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    apiClient
      .get<Collection[]>('/collections')
      .then(setCollections)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load'),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setIsCreating(true);
    setEditTarget(null);
    setNameInput('');
  }

  function openEdit(collection: Collection) {
    setIsCreating(true);
    setEditTarget(collection);
    setNameInput(collection.name);
  }

  function closeDialog() {
    setIsCreating(false);
    setEditTarget(null);
    setNameInput('');
  }

  function save() {
    const request = editTarget
      ? apiClient.patch(`/collections/${editTarget.id}`, { name: nameInput })
      : apiClient.post('/collections', { name: nameInput });

    request.then(() => {
      closeDialog();
      load();
    });
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    apiClient.delete(`/collections/${deleteTarget.id}`).then(() => {
      setDeleteTarget(null);
      load();
    });
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Collections
        </Typography>
        <Button variant="outlined" onClick={() => logout(getAuth0Config())}>
          Sign out
        </Button>
      </Box>

      <Button variant="contained" onClick={openCreate} sx={{ mb: 2 }}>
        New collection
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && collections.length === 0 && (
        <Typography color="text.secondary">No collections yet.</Typography>
      )}

      <List>
        {collections.map((collection) => (
          <ListItem
            key={collection.id}
            secondaryAction={
              <>
                <IconButton
                  aria-label={`edit ${collection.name}`}
                  onClick={() => openEdit(collection)}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  aria-label={`delete ${collection.name}`}
                  onClick={() => setDeleteTarget(collection)}
                >
                  <DeleteIcon />
                </IconButton>
              </>
            }
          >
            <ListItemText
              primary={collection.name}
              secondary={
                <MuiLink
                  component={RouterLink}
                  to={`/bookmarks?collectionId=${collection.id}`}
                >
                  View bookmarks
                </MuiLink>
              }
            />
          </ListItem>
        ))}
      </List>

      <Dialog open={isCreating} onClose={closeDialog}>
        <DialogTitle>
          {editTarget ? 'Edit collection' : 'New collection'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Name"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={save} disabled={!nameInput.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
      >
        <DialogTitle>Delete collection?</DialogTitle>
        <DialogContent>
          Delete "{deleteTarget?.name}"? Its bookmarks will become
          uncategorised, not deleted.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
