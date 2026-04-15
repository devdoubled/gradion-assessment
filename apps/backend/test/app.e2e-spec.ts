import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { globalValidationPipe } from '../src/common/pipes/validation.pipe';
import { UploadsService } from '../src/uploads/uploads.service';

describe('App (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UploadsService)
      .useValue({
        onModuleInit: jest.fn(),
        upload: jest.fn().mockResolvedValue('receipts/test.jpg'),
        getUrl: jest.fn().mockReturnValue('http://localhost:9000/receipts/test.jpg'),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(globalValidationPipe);
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
      .send({ email: 'user@test.com', password: 'password123' })
      .expect(201);

    // 2. login user → JWT
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'password123' })
      .expect(200);
    const userToken: string = loginRes.body.data.accessToken;

    // 3. create report → DRAFT
    const reportRes = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Q1 Travel', description: 'Business trip' })
      .expect(201);
    const reportId: string = reportRes.body.data._id;
    expect(reportRes.body.data.status).toBe('DRAFT');

    // 4. add two items
    const item1Res = await request(app.getHttpServer())
      .post(`/reports/${reportId}/items`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 50,
        currency: 'USD',
        category: 'Transport',
        merchantName: 'Uber',
        transactionDate: '2024-01-15',
      })
      .expect(201);
    const item1Id: string = item1Res.body.data._id;

    await request(app.getHttpServer())
      .post(`/reports/${reportId}/items`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 30,
        currency: 'USD',
        category: 'Meals',
        merchantName: 'Cafe',
        transactionDate: '2024-01-15',
      })
      .expect(201);

    // 5. verify totalAmount = 80
    const reportCheck = await request(app.getHttpServer())
      .get(`/reports/${reportId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(reportCheck.body.data.totalAmount).toBe(80);

    // 6. submit → SUBMITTED
    await request(app.getHttpServer())
      .post(`/reports/${reportId}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    // 7. verify locked — PATCH item should return 400
    await request(app.getHttpServer())
      .patch(`/reports/${reportId}/items/${item1Id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amount: 100 })
      .expect(400);

    // 8. signup admin
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'admin@test.com', password: 'password123', role: 'admin' })
      .expect(201);

    // 9. login admin → admin JWT
    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' })
      .expect(200);
    const adminToken: string = adminLoginRes.body.data.accessToken;

    // 10. approve → APPROVED
    await request(app.getHttpServer())
      .post(`/admin/reports/${reportId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // 11. verify final state: APPROVED, totalAmount unchanged
    const final = await request(app.getHttpServer())
      .get(`/reports/${reportId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(final.body.data.status).toBe('APPROVED');
    expect(final.body.data.totalAmount).toBe(80);

    // 12. verify terminal — approve again should fail
    await request(app.getHttpServer())
      .post(`/admin/reports/${reportId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
