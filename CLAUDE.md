## Critical Rules for JS/React/TypeScript

### Formatting

- **Tab width: 4 spaces** (not 2)
    ```js
    // Use 4 spaces for all indentation
    function example() {
        if (condition) {
            return true;
        }
    }
    ```

### Destructuring

- **Always destructure when possible**, especially in array methods

    ```js
    // ✅ GOOD
    users.map(({ userId, name }) => ({ userId, name }));
    users.filter(({ isActive }) => isActive);

    // ❌ BAD
    users.map((user) => ({ userId: user.userId, name: user.name }));
    users.filter((u) => u.isActive);
    ```

- **Avoid using single-letter variable names**

### TypeScript

- **NEVER use `any` without justification**
    - If absolutely necessary:
        ```ts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // Explanation: [Why any is required here]
        const value: any = externalLibrary.getData();
        ```
    - Prefer `unknown` with type guards over `any`

### React components

- **Type all props and state explicitly**
    - Use types instead of interfaces for props (named just `Props`) unless building a base reusable component

    ```tsx
    type Props = {
        title: string;
        count: number;
        isActive: boolean;
    };

    function MyComponent({ title, count, isActive }: Props) {
        // Component logic
    }
    ```

- **Use functional components and hooks**; avoid class components
- Ordering in components:
    1. Imports
    2. Types
    3. Component function
    4. Data Hooks (useState, custom hooks)
    5. Formatted data/computed values
    6. Event handlers
    7. Effects (useEffect)
    8. Render logic (JSX)

### Quick Reference

```typescript
// Example following ALL conventions:
interface UserData {
    userId: string;
    userName: string;
    isActive: boolean;
}

function processUsers(users: UserData[]): string[] {
    // 4-space indent, destructuring, no single letters
    return users
        .filter(({ isActive }) => isActive)
        .map(({ userId, userName }) => `${userName}-${userId}`);
}

// React component example:
type Props = {
    users: UserData[];
    title: string;
};

function UserList({ users, title }: Props) {
    const activeUsers = users.filter(({ isActive }) => isActive);

    return (
        <div>
            <h2>{title}</h2>
            {activeUsers.map(({ userId, userName }) => (
                <div key={userId}>{userName}</div>
            ))}
        </div>
    );
}

export default UserList;
```

## GraphQL Schema Conventions

### Documentation

- **Every type and field MUST be documented** using GraphQL docstrings
    ```graphql
    """
    Represents a user in the chat application
    """
    type User {
        """
        Unique identifier for the user
        """
        id: ID!
    }
    ```

### Pagination

- **Use cursor-based pagination** with `limit` and `after` parameters
    ```graphql
    type Query {
        messages(
            channelId: String!
            """
            Maximum number of items to return (default: 50)
            """
            limit: Int = 50
            """
            Cursor for pagination - fetch items after this ID
            """
            after: ID
        ): [Message!]!
    }
    ```

### Mutations

- **Every mutation MUST use Input and Payload patterns**

    ```graphql
    # Input type - even for single fields
    input DeleteUserInput {
        id: String!
    }

    # Payload type - even for single return values
    type DeleteUserPayload {
        success: Boolean!
    }

    type Mutation {
        deleteUser(input: DeleteUserInput!): DeleteUserPayload!
    }
    ```

### Type Design

- **Return full types, not IDs** in GraphQL types

    ```graphql
    # ✅ GOOD - Return full related objects
    type Message {
        author: User! # Full User object
        channel: Channel! # Full Channel object
    }

    # ❌ BAD - Don't expose foreign keys
    type Message {
        authorId: String! # Avoid this
        channelId: String! # Avoid this
    }
    ```

### File Organization

- **Each type gets its own directory** under `src/schema/`
    ```
    src/schema/
    ├── user/
    │   ├── user.graphql      # Schema definition
    │   └── user.resolver.ts   # Resolver implementation
    ├── message/
    │   ├── message.graphql
    │   └── message.resolver.ts
    ```

### Subscriptions

- **Use simple parameters** (not Input types) for subscriptions

    ```graphql
    type Subscription {
        # Simple scalar parameters for filtering
        messageAdded(channelId: String!): Message!

        # Return the actual type or custom event types
        userTyping(channelId: String!): TypingEvent!
    }
    ```

### Naming Conventions

- **Types**: PascalCase (e.g., `User`, `ServerMember`)
- **Fields**: camelCase (e.g., `displayName`, `createdAt`)
- **Input types**: Suffix with `Input` (e.g., `CreateUserInput`)
- **Payload types**: Suffix with `Payload` (e.g., `CreateUserPayload`)
- **Enums**: SCREAMING_SNAKE_CASE for values

## Apply These Rules To:

- All JavaScript files (.js, .jsx)
- All TypeScript files (.ts, .tsx)
- React components and hooks
- Node.js backend code
- GraphQL schema files (.graphql)
- GraphQL resolver files
- Test files
