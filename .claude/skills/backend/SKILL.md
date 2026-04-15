# Backend Skill — NestJS + MongoDB + TypeScript

> Claude Code reads this file before generating any backend code.
> Every pattern here is the single correct way to do that thing in this project.
> Do not deviate. Do not invent alternatives.

---

## 1. Module Anatomy

Every NestJS module follows this exact structure. No exceptions.

```
src/[module]/
├── [module].module.ts
├── [module].controller.ts
├── [module].service.ts
├── schemas/
│   └── [module].schema.ts
└── dto/
    ├── create-[module].dto.ts
    └── update-[module].dto.ts
```

Tests live next to source:
```
src/[module]/
├── [module].service.spec.ts
└── [module].controller.spec.ts   (only if controller logic warrants testing)
```

---

## 2. Schema Pattern

Always use `@Schema({ timestamps: true })` and export both the document
interface and the Mongoose schema. Export the model token as a constant.

```typescript
// schemas/expense-report.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExpenseReportDocument = ExpenseReport & Document;

@Schema({ timestamps: true })
export class ExpenseReport {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
    default: 'DRAFT',
  })
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

  @Prop({ type: Number, default: 0 })
  totalAmount: number;
}

export const ExpenseReportSchema = SchemaFactory.createForClass(ExpenseReport);
```

Rules:
- Always `required: true` on foreign keys and mandatory fields
- Use `Types.ObjectId` for refs, not `string`
- `passwordHash` must have `select: false`
- `timestamps: true` on every schema — never add `createdAt`/`updatedAt` manually
- Never add `_id` as a `@Prop` — Mongoose adds it automatically

---

## 3. DTO Pattern

All DTOs use `class-validator`. Update DTOs always extend `PartialType`.

```typescript
// dto/create-expense-report.dto.ts
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateExpenseReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}
```

```typescript
// dto/update-expense-report.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateExpenseReportDto } from './create-expense-report.dto';

export class UpdateExpenseReportDto extends PartialType(CreateExpenseReportDto) {}
```

Rules:
- Every field that comes from the client needs at least one validator
- Never trust `amount` or `totalAmount` from the client — omit from DTOs entirely
- Use `@Type(() => Number)` from `class-transformer` for numeric query params
- Use `@IsEnum(ReportStatus)` for status filter query params

---

## 4. Service Pattern

Services own all business logic. They receive the authenticated user's id
(`userId: string`) as a parameter — never the full request object.

```typescript
// reports.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExpenseReport, ExpenseReportDocument } from './schemas/expense-report.schema';
import { CreateExpenseReportDto } from './dto/create-expense-report.dto';
import { UpdateExpenseReportDto } from './dto/update-expense-report.dto';
import { assertTransition } from './report-state-machine';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(ExpenseReport.name)
    private readonly reportModel: Model<ExpenseReportDocument>,
  ) {}

  async create(userId: string, dto: CreateExpenseReportDto): Promise<ExpenseReportDocument> {
    const report = new this.reportModel({
      ...dto,
      userId: new Types.ObjectId(userId),
      status: 'DRAFT',
      totalAmount: 0,
    });
    return report.save();
  }

  async findAll(userId: string, status?: string): Promise<ExpenseReportDocument[]> {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (status) filter.status = status;
    return this.reportModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOneOwned(id: string, userId: string): Promise<ExpenseReportDocument> {
    const report = await this.reportModel
      .findOne({ _id: id, userId: new Types.ObjectId(userId) })
      .exec();
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateExpenseReportDto,
  ): Promise<ExpenseReportDocument> {
    const report = await this.findOneOwned(id, userId);
    if (report.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT reports can be edited');
    }
    Object.assign(report, dto);
    return report.save();
  }

  async submit(id: string, userId: string): Promise<ExpenseReportDocument> {
    const report = await this.findOneOwned(id, userId);
    assertTransition(report.status, 'SUBMITTED');
    report.status = 'SUBMITTED';
    return report.save();
  }
}
```

Rules:
- Always convert string ids to `new Types.ObjectId(id)` in queries
- Ownership filter `{ _id: id, userId: new Types.ObjectId(userId) }` — returns 404 not 403
- Never use `findById` alone for user-owned resources — always include `userId` in filter
- Throw `NotFoundException` for missing/unauthorized resources
- Throw `BadRequestException` for invalid operations (wrong status, locked report)
- Never catch exceptions in services — let them bubble to the global filter

---

## 5. Controller Pattern

Controllers handle HTTP only. No business logic. No conditional branches.

```typescript
// reports.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ReportsService } from './reports.service';
import { CreateExpenseReportDto } from './dto/create-expense-report.dto';
import { UpdateExpenseReportDto } from './dto/update-expense-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreateExpenseReportDto) {
    return this.reportsService.create(req.user['id'], dto);
  }

  @Get()
  findAll(@Req() req: Request, @Query('status') status?: string) {
    return this.reportsService.findAll(req.user['id'], status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.reportsService.findOneOwned(id, req.user['id']);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateExpenseReportDto,
  ) {
    return this.reportsService.update(id, req.user['id'], dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.reportsService.remove(id, req.user['id']);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Req() req: Request) {
    return this.reportsService.submit(id, req.user['id']);
  }
}
```

Rules:
- Always extract user id as `req.user['id']` — never pass the full `req.user` to services
- DELETE returns 204 No Content via `@HttpCode(HttpStatus.NO_CONTENT)`
- No try/catch in controllers — global HttpExceptionFilter handles it
- No `async/await` needed when returning service promises directly

---

## 6. Module Registration Pattern

```typescript
// reports.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ExpenseReport, ExpenseReportSchema } from './schemas/expense-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExpenseReport.name, schema: ExpenseReportSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],   // export if other modules need this service
})
export class ReportsModule {}
```

Always `exports: [ReportsService]` when another module will inject the service
(e.g. ItemsModule needs ReportsService to check report status).

---

## 7. Guard Pattern

### JwtAuthGuard

```typescript
// common/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

### RolesGuard

```typescript
// common/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user?.role);
  }
}
```

Register both as global guards in `AppModule`:

```typescript
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
],
```

---

## 8. Decorator Pattern

```typescript
// common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

---

## 9. Global Exception Filter

```typescript
// common/filters/http-exception.filter.ts
import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      message: typeof message === 'object' ? (message as any).message : message,
      error: typeof message === 'object' ? (message as any).error : 'Error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

Register in `main.ts`:
```typescript
app.useGlobalFilters(new HttpExceptionFilter());
```

---

## 10. Transform Interceptor

Removes `passwordHash` from all outgoing responses.

```typescript
// common/interceptors/transform.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function stripPasswordHash(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripPasswordHash);
  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      if (key === 'passwordHash') continue;
      result[key] = stripPasswordHash(record[key]);
    }
    return result;
  }
  return obj;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data.toObject === 'function') {
          return stripPasswordHash(data.toObject());
        }
        return stripPasswordHash(data);
      }),
    );
  }
}
```

Register in `main.ts`:
```typescript
app.useGlobalInterceptors(new TransformInterceptor());
```

---

## 11. JWT Strategy Pattern

```typescript
// auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    // This return value is attached to req.user
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
```

JWT payload shape: `{ sub: userId, email, role }`.
`req.user` shape after validation: `{ id, email, role }`.
Always use `req.user['id']` in controllers — never `req.user['sub']`.

---

## 12. State Machine Pattern

Pure functions. No imports from NestJS or Mongoose.

```typescript
// reports/report-state-machine.ts
import { BadRequestException } from '@nestjs/common';

export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export const VALID_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  DRAFT:     ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED:  [],
  REJECTED:  ['DRAFT'],
};

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ReportStatus, to: ReportStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(
      `Invalid status transition: ${from} → ${to}`,
    );
  }
}
```

Unit test file lives at `src/reports/report-state-machine.spec.ts`.
Test every cell of `VALID_TRANSITIONS` — both valid and invalid directions.

---

## 13. MinIO Service Pattern

```typescript
// uploads/uploads.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class UploadsService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'receipts');
    this.client = new Minio.Client({
      endPoint:  this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port:      parseInt(this.configService.get<string>('MINIO_PORT', '9000')),
      useSSL:    this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY'),
    });

    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async upload(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
  ): Promise<string> {
    const ext = path.extname(originalname);
    const key = `receipts/${uuidv4()}${ext}`;
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimetype,
    });
    return key;
  }

  getUrl(key: string): string {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
    const port     = this.configService.get<string>('MINIO_PORT', '9000');
    return `http://${endpoint}:${port}/${this.bucket}/${key}`;
  }
}
```

---

## 14. Extraction Service Pattern

```typescript
// uploads/extraction.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedFields {
  merchantName:    string | null;
  amount:          number | null;
  currency:        string | null;
  transactionDate: string | null;
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private client: Anthropic;

  constructor(private configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  async extract(buffer: Buffer, mimetype: string): Promise<ExtractedFields> {
    const nullResult: ExtractedFields = {
      merchantName: null, amount: null, currency: null, transactionDate: null,
    };

    try {
      const base64 = buffer.toString('base64');
      const mediaType = mimetype as
        'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `Extract the following fields from this receipt and return ONLY
valid JSON with no markdown, no explanation, no extra text:
{
  "merchantName": "string or null",
  "amount": number or null,
  "currency": "ISO 4217 code e.g. USD or null",
  "transactionDate": "ISO 8601 date string or null"
}
If a field cannot be determined, use null.`,
            },
          ],
        }],
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      return JSON.parse(text) as ExtractedFields;
    } catch (err) {
      this.logger.error('Receipt extraction failed', err);
      return nullResult;
    }
  }
}
```

Never throw from `ExtractionService`. Always return `nullResult` on any failure.
The upload flow must complete successfully even when extraction fails.

---

## 15. Unit Test Pattern

```typescript
// reports/report-state-machine.spec.ts
import { BadRequestException } from '@nestjs/common';
import {
  assertTransition,
  canTransition,
  VALID_TRANSITIONS,
} from './report-state-machine';

describe('report-state-machine', () => {
  describe('canTransition', () => {
    it('returns true for DRAFT → SUBMITTED', () => {
      expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true);
    });

    it('returns false for DRAFT → APPROVED', () => {
      expect(canTransition('DRAFT', 'APPROVED')).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('does not throw for valid transitions', () => {
      expect(() => assertTransition('DRAFT', 'SUBMITTED')).not.toThrow();
      expect(() => assertTransition('SUBMITTED', 'APPROVED')).not.toThrow();
      expect(() => assertTransition('SUBMITTED', 'REJECTED')).not.toThrow();
      expect(() => assertTransition('REJECTED', 'DRAFT')).not.toThrow();
    });

    it('throws BadRequestException for DRAFT → APPROVED', () => {
      expect(() => assertTransition('DRAFT', 'APPROVED')).toThrow(BadRequestException);
    });

    it('throws BadRequestException for any transition out of APPROVED', () => {
      const targets = ['DRAFT', 'SUBMITTED', 'REJECTED'] as const;
      targets.forEach((to) => {
        expect(() => assertTransition('APPROVED', to)).toThrow(BadRequestException);
      });
    });
  });
});
```

Rules:
- Test names are sentences describing the expected behaviour
- Each `it` block tests exactly one thing
- Use `not.toThrow()` and `toThrow(SpecificException)` — not `try/catch`
- Never share mutable state between tests

---

## 16. Integration Test Pattern

```typescript
// test/app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    mongoConnection = moduleFixture.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    await mongoConnection.close();
    await mongod.stop();
    await app.close();
  });

  afterEach(async () => {
    const collections = mongoConnection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  it('complete happy path: DRAFT → SUBMITTED → APPROVED', async () => {
    // 1. signup user
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'user@test.com', password: 'password123', role: 'user' })
      .expect(201);

    // 2. login user
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'password123' })
      .expect(200);
    const userToken = loginRes.body.accessToken;

    // 3. create report
    const reportRes = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Q1 Travel', description: 'Business trip' })
      .expect(201);
    const reportId = reportRes.body._id;
    expect(reportRes.body.status).toBe('DRAFT');

    // 4. add items
    await request(app.getHttpServer())
      .post(`/reports/${reportId}/items`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amount: 50, currency: 'USD', category: 'Transport',
              merchantName: 'Uber', transactionDate: '2024-01-15' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/reports/${reportId}/items`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amount: 30, currency: 'USD', category: 'Meals',
              merchantName: 'Cafe', transactionDate: '2024-01-15' })
      .expect(201);

    // 5. verify totalAmount
    const reportCheck = await request(app.getHttpServer())
      .get(`/reports/${reportId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(reportCheck.body.totalAmount).toBe(80);

    // 6. submit
    await request(app.getHttpServer())
      .post(`/reports/${reportId}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    // 7. verify locked — item edit should fail
    await request(app.getHttpServer())
      .post(`/reports/${reportId}/items`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amount: 10, currency: 'USD', category: 'Other',
              merchantName: 'Shop', transactionDate: '2024-01-15' })
      .expect(400);

    // 8. signup + login admin
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'admin@test.com', password: 'password123', role: 'admin' })
      .expect(201);

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' })
      .expect(200);
    const adminToken = adminLogin.body.accessToken;

    // 9. approve
    await request(app.getHttpServer())
      .post(`/admin/reports/${reportId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // 10. verify final state
    const final = await request(app.getHttpServer())
      .get(`/reports/${reportId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(final.body.status).toBe('APPROVED');
    expect(final.body.totalAmount).toBe(80);

    // 11. verify terminal — approve again should fail
    await request(app.getHttpServer())
      .post(`/admin/reports/${reportId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
```

---

## 17. Common Mistakes to Avoid

| Mistake | Correct approach |
|---|---|
| `findById(id)` for user-owned resources | `findOne({ _id: id, userId })` |
| Business logic in controller | Move to service |
| Accepting `totalAmount` from client | Compute server-side, omit from DTO |
| `req.user['sub']` | `req.user['id']` — JwtStrategy returns `id` not `sub` |
| Swallowing exceptions in services | Let them bubble to global filter |
| `new ObjectId(id)` without try/catch | Wrap in `Types.ObjectId` and validate with `@IsMongoId()` in DTO |
| Throwing from `ExtractionService` | Return `nullResult` on any failure |
| Missing `select: false` on passwordHash | Always add to User schema |
| Direct `REJECTED → SUBMITTED` | Must go `REJECTED → DRAFT → SUBMITTED` |