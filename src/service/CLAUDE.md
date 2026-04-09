# src/service/ — Services Guide

## LoggingService

Singleton logger with ISO-timestamped output. Implements `ILoggingService`.

### Interface

```ts
interface ILoggingService {
  info(message: string): void;   // console.log  — ISO timestamp + [INFO]
  warn(message: string): void;   // console.warn — ISO timestamp + [WARN]
  error(message: string): void;  // console.error — ISO timestamp + [ERROR]
}
```

### Factory

```ts
CreateLoggingService(): ILoggingService  // returns/creates the singleton
```

### Usage Across the App

- **`composition.ts`**: Calls `CreateLoggingService()` and injects the instance into `App` and `AuthController` via constructor.
- **`app.ts` / `AuthController.ts`**: Accept `ILoggingService` as a constructor parameter — always depend on the interface, never the concrete class.
- Tests or alternate compositions can inject a mock by passing a custom `ILoggingService` to `createComposedApp(logger?)`.

## Conventions for New Services

1. **Export an interface** (`IFooService`) and a **factory function** (`CreateFooService()`), not the class directly.
2. **Singleton pattern**: Use a module-level `let instance: IFooService | null = null` guard inside the factory if the service is stateless/shared.
3. **Wire in `composition.ts`**: All dependency injection happens there. Do not instantiate services inside controllers or routes.
4. **Constructor injection**: Controllers and handlers receive services as constructor parameters typed to the interface.
5. Keep services focused — one responsibility per service file.
