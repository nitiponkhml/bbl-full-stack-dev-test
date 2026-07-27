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
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { apiClient } from '../api/client';
import type { Bookmark, Collection } from '../api/types';
import { getAuth0Config } from '../auth/config';
import { logout } from '../auth/logout';

const UNCATEGORISED = '';

export function Bookmarks(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const collectionIdFilter = searchParams.get('collectionId');

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<Bookmark | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [collectionIdInput, setCollectionIdInput] = useState(UNCATEGORISED);

  const [deleteTarget, setDeleteTarget] = useState<Bookmark | null>(null);

  useEffect(() => {
    apiClient.get<Collection[]>('/collections').then(setCollections);
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    const path = collectionIdFilter
      ? `/bookmarks?collectionId=${collectionIdFilter}`
      : '/bookmarks';
    apiClient
      .get<Bookmark[]>(path)
      .then(setBookmarks)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load'),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionIdFilter]);

  function openCreate() {
    setIsEditing(true);
    setEditTarget(null);
    setUrlInput('');
    setTitleInput('');
    setNotesInput('');
    setCollectionIdInput(UNCATEGORISED);
  }

  function openEdit(bookmark: Bookmark) {
    setIsEditing(true);
    setEditTarget(bookmark);
    setUrlInput(bookmark.url);
    setTitleInput(bookmark.title);
    setNotesInput(bookmark.notes ?? '');
    setCollectionIdInput(bookmark.collectionId ?? UNCATEGORISED);
  }

  function closeDialog() {
    setIsEditing(false);
    setEditTarget(null);
  }

  function save() {
    const payload = {
      url: urlInput,
      title: titleInput,
      notes: notesInput.trim() ? notesInput : null,
      collectionId: collectionIdInput || null,
    };
    const request = editTarget
      ? apiClient.patch(`/bookmarks/${editTarget.id}`, payload)
      : apiClient.post('/bookmarks', payload);

    request.then(() => {
      closeDialog();
      load();
    });
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    apiClient.delete(`/bookmarks/${deleteTarget.id}`).then(() => {
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
          Bookmarks
        </Typography>
        <Button variant="outlined" onClick={() => logout(getAuth0Config())}>
          Sign out
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
        <Button variant="contained" onClick={openCreate}>
          New bookmark
        </Button>
        <Select
          size="small"
          value={collectionIdFilter ?? UNCATEGORISED}
          displayEmpty
          onChange={(event) => {
            const value = event.target.value;
            setSearchParams(value ? { collectionId: value } : {});
          }}
        >
          <MenuItem value={UNCATEGORISED}>All collections</MenuItem>
          {collections.map((collection) => (
            <MenuItem key={collection.id} value={collection.id}>
              {collection.name}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && bookmarks.length === 0 && (
        <Typography color="text.secondary">No bookmarks yet.</Typography>
      )}

      <List>
        {bookmarks.map((bookmark) => (
          <ListItem
            key={bookmark.id}
            secondaryAction={
              <>
                <IconButton
                  aria-label={`edit ${bookmark.title}`}
                  onClick={() => openEdit(bookmark)}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  aria-label={`delete ${bookmark.title}`}
                  onClick={() => setDeleteTarget(bookmark)}
                >
                  <DeleteIcon />
                </IconButton>
              </>
            }
          >
            <ListItemText
              primary={bookmark.title}
              secondary={
                <MuiLink
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {bookmark.url}
                </MuiLink>
              }
            />
          </ListItem>
        ))}
      </List>

      <Dialog open={isEditing} onClose={closeDialog}>
        <DialogTitle>
          {editTarget ? 'Edit bookmark' : 'New bookmark'}
        </DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 320,
          }}
        >
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="URL"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
          />
          <TextField
            fullWidth
            margin="dense"
            label="Title"
            value={titleInput}
            onChange={(event) => setTitleInput(event.target.value)}
          />
          <TextField
            fullWidth
            margin="dense"
            label="Notes"
            multiline
            minRows={2}
            value={notesInput}
            onChange={(event) => setNotesInput(event.target.value)}
          />
          <Select
            value={collectionIdInput}
            displayEmpty
            onChange={(event) => setCollectionIdInput(event.target.value)}
          >
            <MenuItem value={UNCATEGORISED}>Uncategorised</MenuItem>
            {collections.map((collection) => (
              <MenuItem key={collection.id} value={collection.id}>
                {collection.name}
              </MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={save}
            disabled={!urlInput.trim() || !titleInput.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
      >
        <DialogTitle>Delete bookmark?</DialogTitle>
        <DialogContent>Delete "{deleteTarget?.title}"?</DialogContent>
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
