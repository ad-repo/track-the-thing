"""
Integration tests for custom emoji API endpoints.
"""

import io

from fastapi.testclient import TestClient


class TestCustomEmojisAPI:
    """Test custom emoji CRUD operations."""

    def test_create_custom_emoji_success(self, client: TestClient):
        """Test successful custom emoji upload."""
        # Create a fake PNG image
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

        response = client.post(
            '/api/custom-emojis',
            data={
                'name': 'test_smile',
                'category': 'Test',
                'keywords': 'test,smile,happy',
            },
            files={'file': ('test.png', io.BytesIO(image_data), 'image/png')},
        )

        assert response.status_code == 200
        data = response.json()
        assert data['name'] == 'test_smile'
        assert data['category'] == 'Test'
        assert data['keywords'] == 'test,smile,happy'
        assert data['is_deleted'] is False
        assert 'image_url' in data
        assert data['image_url'].startswith('/api/uploads/files/')

    def test_create_custom_emoji_duplicate_name(self, client: TestClient):
        """Test that duplicate emoji names are rejected."""
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

        # Create first emoji
        client.post(
            '/api/custom-emojis',
            data={'name': 'duplicate_test', 'category': 'Test', 'keywords': ''},
            files={'file': ('test1.png', io.BytesIO(image_data), 'image/png')},
        )

        # Try to create duplicate
        response = client.post(
            '/api/custom-emojis',
            data={'name': 'duplicate_test', 'category': 'Test', 'keywords': ''},
            files={'file': ('test2.png', io.BytesIO(image_data), 'image/png')},
        )

        assert response.status_code == 400
        assert 'already exists' in response.json()['detail'].lower()

    def test_create_custom_emoji_invalid_file_type(self, client: TestClient):
        """Test that non-image files are rejected."""
        text_data = b'This is not an image'

        response = client.post(
            '/api/custom-emojis',
            data={'name': 'invalid', 'category': 'Test', 'keywords': ''},
            files={'file': ('test.txt', io.BytesIO(text_data), 'text/plain')},
        )

        assert response.status_code == 400
        assert 'image' in response.json()['detail'].lower()

    def test_get_all_custom_emojis(self, client: TestClient):
        """Test retrieving all custom emojis."""
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

        # Create two emojis
        client.post(
            '/api/custom-emojis',
            data={'name': 'emoji1', 'category': 'Test', 'keywords': 'one'},
            files={'file': ('emoji1.png', io.BytesIO(image_data), 'image/png')},
        )
        client.post(
            '/api/custom-emojis',
            data={'name': 'emoji2', 'category': 'Test', 'keywords': 'two'},
            files={'file': ('emoji2.png', io.BytesIO(image_data), 'image/png')},
        )

        response = client.get('/api/custom-emojis')
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        names = [emoji['name'] for emoji in data]
        assert 'emoji1' in names
        assert 'emoji2' in names

    def test_get_custom_emoji_by_id(self, client: TestClient):
        """Test retrieving a single custom emoji by ID."""
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

        create_response = client.post(
            '/api/custom-emojis',
            data={'name': 'get_test', 'category': 'Test', 'keywords': 'test'},
            files={'file': ('test.png', io.BytesIO(image_data), 'image/png')},
        )
        emoji_id = create_response.json()['id']

        response = client.get(f'/api/custom-emojis/{emoji_id}')
        assert response.status_code == 200
        data = response.json()
        assert data['id'] == emoji_id
        assert data['name'] == 'get_test'

    def test_get_nonexistent_custom_emoji(self, client: TestClient):
        """Test retrieving a non-existent emoji returns 404."""
        response = client.get('/api/custom-emojis/99999')
        assert response.status_code == 404

    def test_update_custom_emoji(self, client: TestClient):
        """Test updating custom emoji metadata."""
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

        create_response = client.post(
            '/api/custom-emojis',
            data={'name': 'update_test', 'category': 'Test', 'keywords': 'old'},
            files={'file': ('test.png', io.BytesIO(image_data), 'image/png')},
        )
        emoji_id = create_response.json()['id']

        response = client.patch(
            f'/api/custom-emojis/{emoji_id}',
            json={
                'name': 'updated_name',
                'category': 'Updated',
                'keywords': 'new,keywords',
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data['name'] == 'updated_name'
        assert data['category'] == 'Updated'
        assert data['keywords'] == 'new,keywords'

    def test_update_custom_emoji_duplicate_name(self, client: TestClient):
        """Test that updating to a duplicate name is rejected."""
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

        # Create two emojis
        client.post(
            '/api/custom-emojis',
            data={'name': 'first', 'category': 'Test', 'keywords': ''},
            files={'file': ('test1.png', io.BytesIO(image_data), 'image/png')},
        )
        create_response = client.post(
            '/api/custom-emojis',
            data={'name': 'second', 'category': 'Test', 'keywords': ''},
            files={'file': ('test2.png', io.BytesIO(image_data), 'image/png')},
        )
        emoji_id = create_response.json()['id']

        # Try to update second to first's name
        response = client.patch(
            f'/api/custom-emojis/{emoji_id}',
            json={'name': 'first'},
        )

        assert response.status_code == 400
        assert 'already exists' in response.json()['detail'].lower()

    def test_soft_delete_custom_emoji(self, client: TestClient):
        """Test soft-deleting a custom emoji."""
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

        create_response = client.post(
            '/api/custom-emojis',
            data={'name': 'soft_delete_test', 'category': 'Test', 'keywords': ''},
            files={'file': ('test.png', io.BytesIO(image_data), 'image/png')},
        )
        emoji_id = create_response.json()['id']

        # Soft delete
        response = client.delete(f'/api/custom-emojis/{emoji_id}')
        assert response.status_code == 200
        assert 'soft-deleted' in response.json()['message'].lower()

        # Verify it's not in default list
        list_response = client.get('/api/custom-emojis')
        names = [emoji['name'] for emoji in list_response.json()]
        assert 'soft_delete_test' not in names

        # Verify it's in list with include_deleted
        list_response = client.get('/api/custom-emojis?include_deleted=true')
        names = [emoji['name'] for emoji in list_response.json()]
        assert 'soft_delete_test' in names

    def test_delete_nonexistent_custom_emoji(self, client: TestClient):
        """Test deleting a non-existent emoji returns 404."""
        response = client.delete('/api/custom-emojis/99999')
        assert response.status_code == 404

    def test_custom_emoji_ordering(self, client: TestClient):
        """Test that custom emojis are ordered by name."""
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

        # Create emojis in non-alphabetical order
        for name in ['zebra', 'apple', 'mango']:
            client.post(
                '/api/custom-emojis',
                data={'name': name, 'category': 'Test', 'keywords': ''},
                files={'file': (f'{name}.png', io.BytesIO(image_data), 'image/png')},
            )

        response = client.get('/api/custom-emojis')
        names = [emoji['name'] for emoji in response.json()]

        # Find our test emojis
        test_names = [n for n in names if n in ['zebra', 'apple', 'mango']]
        assert test_names == ['apple', 'mango', 'zebra']
