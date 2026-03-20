from db.connection import db_connection


class ImageRepository:
    @staticmethod
    def create_image(
        *,
        original_name: str,
        stored_name: str,
        file_path: str,
        file_url: str,
        extension: str,
        size_bytes: int,
    ) -> dict:
        query = """
        INSERT INTO images (
            original_name,
            stored_name,
            file_path,
            file_url,
            extension,
            size_bytes
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING
            id,
            original_name,
            stored_name,
            file_path,
            file_url,
            extension,
            size_bytes,
            created_at;
        """

        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    (
                        original_name,
                        stored_name,
                        file_path,
                        file_url,
                        extension,
                        size_bytes,
                    ),
                )
                return cursor.fetchone()


    @staticmethod
    def delete_by_id(image_id: int) -> dict | None:
        query = """
        DELETE FROM images
        WHERE id = %s
        RETURNING
            id,
            original_name,
            stored_name,
            file_path,
            file_url,
            extension,
            size_bytes,
            created_at;
        """

        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (image_id,))
                return cursor.fetchone()


    @staticmethod
    def count_images() -> int:
        query = """
        SELECT COUNT(*) AS total
        FROM images;
        """

        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                row = cursor.fetchone()
                return int(row['total'])


    @staticmethod
    def list_images_paginated(limit: int, offset: int) -> list[dict]:
        query = """
        SELECT
            id,
            original_name,
            stored_name,
            file_path,
            file_url,
            extension,
            size_bytes,
            created_at
        FROM images
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s;
        """

        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (limit, offset))
                return cursor.fetchall()